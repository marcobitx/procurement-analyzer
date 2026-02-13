# backend/app/prompts/extraction.py
# Per-document extraction prompt templates (Lithuanian).
# Used by services/extraction.py to instruct LLM on data extraction.
# Related: services/extraction.py, models/schemas.py

EXTRACTION_SYSTEM = """\
Tu esi patyręs viešųjų pirkimų dokumentų analitikas Lietuvoje. \
Tavo užduotis — kruopščiai išanalizuoti pateiktą dokumentą ir ištraukti visą struktūrizuotą informaciją.

Taisyklės:
- Jei informacijos nėra šiame dokumente, grąžink null tam laukui
- Citatuok tikslias reikšmes: sumas, datas, terminus, procentus
- Sumas rašyk skaičiais (ne žodžiais), valiutą nurodyk atskirai
- Datas formatuok ISO 8601 (YYYY-MM-DD)
- Jei matai neaiškumą ar galimą prieštaravimą, aprašyk confidence_notes lauke
- confidence_notes VISADA turi būti masyvas/list, pvz: ["pastaba1", "pastaba2"] arba []
- Visą tekstą rašyk lietuvių kalba
- Neišgalvok informacijos — tik tai, kas yra dokumente
- Atsakyk TIK JSON formatu — be markdown, be papildomo teksto"""

EXTRACTION_USER = """\
Analizuojamas dokumentas:
- Failo pavadinimas: {filename}
- Dokumento tipas: {document_type}
- Puslapių skaičius: {page_count}

Dokumento turinys:
---
{content}
---

Ištrauk informaciją pagal nurodytą JSON schemą."""
