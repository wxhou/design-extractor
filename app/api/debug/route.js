import { NextResponse } from 'next/server';

export async function GET() {
  const results = {};
  
  // Test 1: Import code-generators
  try {
    const mod = await import('@/src/code-generators.js');
    results.codegen = 'ok';
    results.toCssName = typeof mod.toCssName === 'function' ? 'ok' : 'not function';
    results.generateTokensJson = typeof mod.generateTokensJson === 'function' ? 'ok' : 'not function';
    results.toCssNameTest = mod.toCssName('test') === 'test' ? 'ok' : 'fail';
    results.toCssNameUndefined = mod.toCssName(undefined) === 'unknown' ? 'ok' : 'fail';
  } catch(e) {
    results.codegen = 'error: ' + e.message;
  }
  
  // Test 2: Import extractor-v2 barrel
  try {
    const mod = await import('@/src/extractor-v2.js');
    results.barrel = 'ok';
    results.barrelExports = Object.keys(mod).filter(k => k !== 'default').length;
  } catch(e) {
    results.barrel = 'error: ' + e.message;
  }
  
  // Test 3: Generate tokens with real data
  try {
    const { generateTokensJson } = await import('@/src/code-generators.js');
    const data = {
      colors: [{hex: '#fff', name: 'white'}],
      fonts: ['Inter', 'Roboto'],
      typeScale: {steps: []},
      gradients: [],
    };
    const result = generateTokensJson(data);
    results.generate = 'ok';
    results.output = result.substring(0, 100);
  } catch(e) {
    results.generate = 'error: ' + e.message + '\n' + e.stack?.substring(0, 200);
  }
  
  return NextResponse.json(results);
}
