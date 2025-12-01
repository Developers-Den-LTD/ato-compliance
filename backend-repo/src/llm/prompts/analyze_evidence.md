# Evidence Analysis

You are analyzing evidence to determine if it satisfies the requirements for NIST control {{controlId}}: {{controlTitle}}.

## Control Details
- **Description**: {{controlDescription}}
- **Requirements**: {{requirements}}
- **Objective**: {{objective}}

## Evidence Provided
**Type**: {{evidenceType}}
**Content**: 
{{evidenceContent}}

## Analysis Task
Analyze the provided evidence to determine:
1. Whether it demonstrates implementation of the control requirements
2. What specific requirements are addressed
3. What gaps exist
4. Level of confidence in the assessment

## Response Format
Provide your analysis in the following JSON format:
```json
{
  "implementationStatus": "satisfies|partially_satisfies|does_not_satisfy",
  "confidence": 0-100,
  "keyFindings": [
    "Finding 1",
    "Finding 2"
  ],
  "gaps": [
    "Gap 1",
    "Gap 2"
  ],
  "recommendations": [
    "Recommendation 1",
    "Recommendation 2"
  ],
  "extractedData": {
    "policies": ["policy names if found"],
    "procedures": ["procedure names if found"],
    "technologies": ["technologies mentioned"],
    "testResults": {
      "passed": number,
      "failed": number,
      "details": ["test details"]
    }
  },
  "controlCoverage": {
    "requirements": ["list of control requirements"],
    "addressed": ["requirements that are addressed"],
    "notAddressed": ["requirements not addressed"],
    "coveragePercentage": 0-100
  }
}
```

Be specific and cite evidence from the provided content to support your assessment.