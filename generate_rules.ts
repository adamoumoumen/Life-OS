import fs from 'fs';
import path from 'path';

interface Blueprint {
  rulesVersion: string;
  collections: {
    name: string;
    path: string;
    description?: string;
    permissions: {
      read?: string;
      write?: string;
      create?: string;
      update?: string;
      delete?: string;
    };
  }[];
}

function generateRules() {
  const blueprintPath = path.resolve('firebase-blueprint.json');
  const blueprint: Blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

  let rules = `rules_version = '${blueprint.rulesVersion}';\n\n`;
  rules += `service cloud.firestore {\n`;
  rules += `  match /databases/{database}/documents {\n\n`;

  for (const collection of blueprint.collections) {
    if (collection.description) {
      rules += `    // ${collection.description}\n`;
    }
    rules += `    match /${collection.path} {\n`;
    
    const permissions = collection.permissions;
    if (permissions.read) rules += `      allow read: if ${permissions.read};\n`;
    if (permissions.write) rules += `      allow write: if ${permissions.write};\n`;
    if (permissions.create) rules += `      allow create: if ${permissions.create};\n`;
    if (permissions.update) rules += `      allow update: if ${permissions.update};\n`;
    if (permissions.delete) rules += `      allow delete: if ${permissions.delete};\n`;
    
    rules += `    }\n\n`;
  }

  rules += `  }\n`;
  rules += `}\n`;

  fs.writeFileSync('firestore.rules', rules);
  console.log('Successfully generated firestore.rules');
}

generateRules();
