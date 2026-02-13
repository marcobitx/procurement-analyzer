# backend/app/services/zip_extractor.py
# Recursive ZIP file extraction service
# Unpacks nested ZIPs and filters to supported file formats (PDF, DOCX, XLSX, etc.)
# Handles: nested ZIPs, unicode filenames, corrupt archives, path traversal attacks
# Related: pipeline.py (called during UNPACKING phase)

import logging
import os
import tempfile
import zipfile
from pathlib import Path

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS: set[str] = {
    ".pdf", ".docx", ".xlsx", ".pptx",
    ".png", ".tiff", ".jpg", ".jpeg",
}


def _sanitize_filename(filename: str) -> str | None:
    """Sanitize a filename from a ZIP archive to prevent path traversal attacks.

    Strips leading slashes, parent directory references, and drive letters.
    Returns None if the filename is empty or resolves to nothing after sanitization.
    """
    # Normalize path separators
    cleaned = filename.replace("\\", "/")

    # Strip any leading slashes or drive letters (e.g., C:/)
    # Path traversal: remove all ../ components
    parts: list[str] = []
    for part in cleaned.split("/"):
        if part in ("", ".", ".."):
            continue
        # Strip drive letter prefix (e.g., "C:")
        if len(part) == 2 and part[1] == ":":
            continue
        parts.append(part)

    if not parts:
        return None

    return os.path.join(*parts)


async def _extract_zip(
    zip_path: Path,
    dest_dir: Path,
    *,
    _depth: int = 0,
    _max_depth: int = 10,
) -> list[tuple[Path, str]]:
    """Extract a ZIP file recursively, handling nested ZIPs.

    Args:
        zip_path: Path to the ZIP file to extract.
        dest_dir: Directory to extract files into.
        _depth: Current recursion depth (internal).
        _max_depth: Maximum recursion depth to prevent ZIP bombs.

    Returns:
        Flat list of (extracted_file_path, original_filename) tuples
        containing only files with supported extensions.

    Handles:
        - Nested ZIPs (ZIP inside ZIP) — recursively extracts
        - Unicode filenames
        - Corrupt ZIPs (logs warning, skips)
        - Path traversal attacks (sanitizes filenames)
        - ZIP bomb protection via depth limit
    """
    if _depth > _max_depth:
        logger.warning(
            "Maximum ZIP nesting depth (%d) exceeded for %s — skipping",
            _max_depth,
            zip_path.name,
        )
        return []

    results: list[tuple[Path, str]] = []

    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            for info in zf.infolist():
                # Skip directories
                if info.is_dir():
                    continue

                # Sanitize the filename to prevent path traversal
                safe_name = _sanitize_filename(info.filename)
                if safe_name is None:
                    logger.warning(
                        "Skipping ZIP entry with invalid name: %r in %s",
                        info.filename,
                        zip_path.name,
                    )
                    continue

                # Build a safe extraction path
                target_path = dest_dir / safe_name

                # Ensure the target is within dest_dir (belt-and-suspenders check)
                try:
                    target_path.resolve().relative_to(dest_dir.resolve())
                except ValueError:
                    logger.warning(
                        "Path traversal detected for %r in %s — skipping",
                        info.filename,
                        zip_path.name,
                    )
                    continue

                # Create parent directories
                target_path.parent.mkdir(parents=True, exist_ok=True)

                # Extract the file
                try:
                    with zf.open(info) as src, open(target_path, "wb") as dst:
                        dst.write(src.read())
                except Exception:
                    logger.warning(
                        "Failed to extract %r from %s — skipping",
                        info.filename,
                        zip_path.name,
                        exc_info=True,
                    )
                    continue

                ext = target_path.suffix.lower()

                # Nested ZIP: recurse into it
                if ext == ".zip":
                    nested_dest = Path(tempfile.mkdtemp(
                        prefix=f"nested_zip_{_depth + 1}_",
                    ))
                    logger.debug(
                        "Found nested ZIP %r (depth %d) — extracting to %s",
                        safe_name,
                        _depth + 1,
                        nested_dest,
                    )
                    nested_results = await _extract_zip(
                        target_path,
                        nested_dest,
                        _depth=_depth + 1,
                        _max_depth=_max_depth,
                    )
                    results.extend(nested_results)

                # Supported extension: include in results
                elif ext in SUPPORTED_EXTENSIONS:
                    # Use just the base filename as the original name
                    original_name = Path(safe_name).name
                    results.append((target_path, original_name))
                    logger.debug(
                        "Extracted supported file: %s from %s",
                        original_name,
                        zip_path.name,
                    )
                else:
                    logger.debug(
                        "Skipping unsupported file %r (%s) in %s",
                        safe_name,
                        ext,
                        zip_path.name,
                    )

    except zipfile.BadZipFile:
        logger.warning(
            "Corrupt or invalid ZIP file: %s — skipping",
            zip_path.name,
        )
    except Exception:
        logger.error(
            "Unexpected error processing ZIP file: %s — skipping",
            zip_path.name,
            exc_info=True,
        )

    return results


async def extract_files(
    upload_paths: list[Path],
) -> list[tuple[Path, str]]:
    """Process uploaded files, extracting ZIPs and filtering to supported formats.

    Takes a list of uploaded file paths (which may include ZIP archives).
    - Regular files with supported extensions → pass through as-is
    - ZIP files → extract recursively (handles nested ZIPs)
    - Unsupported file types → filtered out with a warning

    Args:
        upload_paths: List of paths to uploaded files.

    Returns:
        Flat list of (file_path, original_filename) tuples for all
        supported files (both direct uploads and extracted from ZIPs).
    """
    results: list[tuple[Path, str]] = []

    for path in upload_paths:
        if not path.exists():
            logger.warning("Upload path does not exist: %s — skipping", path)
            continue

        ext = path.suffix.lower()

        if ext == ".zip":
            # Extract ZIP to a temp directory
            dest_dir = Path(tempfile.mkdtemp(prefix="zip_extract_"))
            logger.info(
                "Extracting ZIP file %s to %s",
                path.name,
                dest_dir,
            )
            extracted = await _extract_zip(path, dest_dir)
            results.extend(extracted)
            logger.info(
                "Extracted %d supported files from %s",
                len(extracted),
                path.name,
            )

        elif ext in SUPPORTED_EXTENSIONS:
            # Pass through supported files directly
            results.append((path, path.name))
            logger.debug("Passing through supported file: %s", path.name)

        else:
            logger.warning(
                "Unsupported file type %r for upload %s — skipping",
                ext,
                path.name,
            )

    logger.info(
        "File extraction complete: %d input files → %d supported files",
        len(upload_paths),
        len(results),
    )
    return results
