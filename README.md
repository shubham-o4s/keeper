### How to add new package

- Create new folder and initialize package.json
```json
{
  "name": "@o4s/package-name",
  "version": "0.0.1",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "publishConfig": {
    "registry": "http://registry.o4s.in:8081/repository/o4s-dev-internal/"
  },
  "scripts": {
    "ts-node": "ts-node",
    "prestart": "npm run build",
    "start": "node .",
    "test": "mocha -r ts-node/register tests/**/*.spec.ts",
    "build": "npm run test && tsc",
    "watch": "tsc -w -p ./src -p ./tsconfig.json"
  },
  "author": "",
  "license": "ISC",
  "files": [
    "dist/**/*"
  ]
}

```
- Keep dev dependencies like types separately (using --save-dev)
- Initialize tsconfig.ts file

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "lib": ["es2017", "es2017.object"],
    "target": "es2017",
    "noImplicitAny": false,
    "outDir": "./dist",
    "inlineSourceMap": true,
    "newLine": "LF",
    "declaration": true,
    "experimentalDecorators": true,
    "strictNullChecks": true,
    "noUnusedParameters": false,
    "noUnusedLocals": false,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "allowUnreachableCode": false,
    "noEmitOnError": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/tests/*"]
}

```
- Login to nexus (username=admin password=admin123)
```sh
npm login --registry=http://registry.o4s.in:8081/repository/o4s-dev-internal/
```

- Publish to nexus
```sh
npm publish
```

- To use the package:
```sh
echo "registry=http://registry.o4s.in:8081/repository/npm-dev-group/" > .npmrc

npm login --registry=http://registry.o4s.in:8081/repository/npm-dev-group/

npm i @o4s/package-name
```
