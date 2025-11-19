#!/usr/bin/env node

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

// Configuration
const PROTO_DIR = path.join(__dirname, '../proto')
const OUTPUT_DIR = path.join(__dirname, '../src/proto')
const PROTO_FILE = 'tunnel_service.proto'

// Ensure directories exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

// Build protoc command
const pluginPath = path.join(__dirname, '../node_modules/.bin/protoc-gen-ts_proto.cmd')
const absolutePluginPath = path.resolve(pluginPath)

const command = `protoc ` +
  `--proto_path=${PROTO_DIR} ` +
  `--plugin=protoc-gen-ts_proto="${absolutePluginPath}" ` +
  `--ts_proto_out=${OUTPUT_DIR} ` +
  `--ts_proto_opt=outputServices=generic-definitions,outputServices=default,esModuleInterop=true ` +
  `${path.join(PROTO_DIR, PROTO_FILE)}`

console.log('\nGenerating TypeScript from proto...')
console.log(`Command: ${command}\n`)

try {
  execSync(command, { stdio: 'inherit' })
  console.log(`\n✓ Successfully generated TypeScript types in ${OUTPUT_DIR}`)
  console.log(`✓ Generated file: ${path.join(OUTPUT_DIR, 'tunnel_service.ts')}`)
} catch (error) {
  console.error('\n✗ Failed to generate TypeScript from proto')
  console.error(error.message)
  process.exit(1)
}
