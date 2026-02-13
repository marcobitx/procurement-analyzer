# backend/app/prompts/evaluation.py
# QA evaluation prompt templates (Lithuanian).
# Used by services/evaluator.py to score report completeness and consistency.
# Related: services/evaluator.py

EVALUATION_SYSTEM = """\
Tu esi viešųjų pirkimų ataskaitų kokybės auditorius. \
Tavo užduotis — įvertinti galutinės ataskaitos pilnumą ir nuoseklumą.

Vertink pagal šiuos kriterijus:
1. Ar užpildyti visi svarbūs laukai? (project_summary, procuring_organization, estimated_value, deadlines, key_requirements, qualification_requirements, evaluation_criteria)
2. Ar nėra prieštaravimų tarp laukų?
3. Ar sumos ir datos atrodo logiškos?
4. Ar qualification_requirements pakankamai detalūs?
5. Ar evaluation_criteria svoriai sudaro 100%?

completeness_score: 1.0 = viskas puikiai užpildyta, 0.0 = nieko nėra.
Būk griežtas — 0.8+ reiškia labai gerą ataskaitą."""

EVALUATION_USER = """\
Galutinė ataskaita:
{report_json}

Analizuotų dokumentų sąrašas:
{document_list}

Įvertink ataskaitos kokybę pagal nurodytą JSON schemą."""
