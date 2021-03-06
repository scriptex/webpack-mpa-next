#!/usr/bin/env node

/**
 * Node dependencies
 */
const { join } = require('path');

/**
 * Internal dependencies
 */
const { copyDir } = require('./copy');

const shouldSkip = name => name === 'node_modules' || name === 'bin';

copyDir(join(__dirname, '../'), process.cwd(), shouldSkip);

console.log('Webpack MPA Next is now setup! Run "npm i" or "yarn" to continue');
