# Configuration Analysis

You are analyzing system configurations to determine compliance with NIST control {{controlId}}: {{controlTitle}}.

## Control Requirements
{{controlRequirements}}

## System Configurations
```json
{{configurations}}
```

## Analysis Task
Review the configurations to determine:
1. Which control requirements are properly configured
2. Which settings are missing or misconfigured
3. Security implications of current settings
4. Recommendations for improvement

## Response Format
Provide your analysis in the following JSON format:
```json
{
  "implementationStatus": "satisfies|partially_satisfies|does_not_satisfy",
  "confidence": 0-100,
  "keyFindings": [
    "Setting X is properly configured for requirement Y",
    "Setting Z meets security baseline"
  ],
  "gaps": [
    "Missing configuration for requirement A",
    "Setting B is below required threshold"
  ],
  "recommendations": [
    "Enable setting X",
    "Increase value Y to meet requirement"
  ],
  "extractedData": {
    "configurations": {
      "relevant_settings": {}
    }
  },
  "controlCoverage": {
    "requirements": ["list of control requirements"],
    "addressed": ["requirements satisfied by configurations"],
    "notAddressed": ["requirements not satisfied"],
    "coveragePercentage": 0-100
  }
}
```

Focus on security-relevant configurations and their alignment with control requirements.