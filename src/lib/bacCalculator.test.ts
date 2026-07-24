import {
  calculateAlcoholGrams,
  calculateBAC,
  calculatePermille,
  calculateHoursToZero,
  getIntoxicationLevel,
  calculateDynamicBAC
} from './bacCalculator';
import { Drink } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertClose(actual: number, expected: number, precision = 0.0001, message = '') {
  if (Math.abs(actual - expected) > precision) {
    throw new Error(`Assertion failed: ${message}. Expected ${expected} but got ${actual}`);
  }
}

console.log('🧪 Starting BAC Calculator Unit Tests...\n');

// 1. Test calculateAlcoholGrams
try {
  console.log('1. Testing calculateAlcoholGrams...');
  // 500 ml beer of 5% abv -> 500 * 0.05 * 0.789 = 19.725g
  assertClose(calculateAlcoholGrams(500, 5), 19.725, 0.001, '500ml 5% beer');
  // 150 ml wine of 12% abv -> 150 * 0.12 * 0.789 = 14.202g
  assertClose(calculateAlcoholGrams(150, 12), 14.202, 0.001, '150ml 12% wine');
  // 50 ml vodka of 40% abv -> 50 * 0.40 * 0.789 = 15.78g
  assertClose(calculateAlcoholGrams(50, 40), 15.78, 0.001, '50ml 40% vodka');
  // Edge cases
  assert(calculateAlcoholGrams(0, 40) === 0, 'Zero volume');
  assert(calculateAlcoholGrams(50, 0) === 0, 'Zero ABV');
  console.log('   ✓ calculateAlcoholGrams passed');

  // 2. Test calculateBAC
  console.log('2. Testing calculateBAC (Widmark)...');
  // 19.725g of alcohol, 80kg male (r = 0.68), 0 hours since first drink
  // BAC = (19.725 / (80 * 0.68 * 1000)) * 100 = (19.725 / 54400) * 100 = 0.036259%
  const bac0 = calculateBAC(19.725, 80, 0.68, 0);
  assertClose(bac0, 0.036259, 0.0001, 'BAC at 0 hours');

  // 2 hours later: 0.036259 - 0.015 * 2 = 0.006259%
  const bac2 = calculateBAC(19.725, 80, 0.68, 2);
  assertClose(bac2, 0.006259, 0.0001, 'BAC at 2 hours');

  // 3 hours later: 0.036259 - 0.015 * 3 = -0.00874 (should clamp to 0)
  const bac3 = calculateBAC(19.725, 80, 0.68, 3);
  assert(bac3 === 0, 'BAC clamped to zero');
  console.log('   ✓ calculateBAC passed');

  // 3. Test calculatePermille
  console.log('3. Testing calculatePermille...');
  assertClose(calculatePermille(0.0362), 0.362, 0.001, 'Convert 0.0362% to permille');
  assert(calculatePermille(0) === 0, 'Convert 0% to permille');
  console.log('   ✓ calculatePermille passed');

  // 4. Test calculateHoursToZero
  console.log('4. Testing calculateHoursToZero...');
  assertClose(calculateHoursToZero(0.03), 2.0, 0.001, '0.03% to zero hours');
  assert(calculateHoursToZero(0) === 0, '0% to zero hours');
  console.log('   ✓ calculateHoursToZero passed');

  // 5. Test getIntoxicationLevel
  console.log('5. Testing getIntoxicationLevel...');
  assert(getIntoxicationLevel(0.01).key === 'Sober', '0.01% is Sober');
  assert(getIntoxicationLevel(0.03).key === 'Light', '0.03% is Light');
  assert(getIntoxicationLevel(0.07).key === 'Buzzed', '0.07% is Buzzed');
  assert(getIntoxicationLevel(0.12).key === 'Drunk', '0.12% is Drunk');
  assert(getIntoxicationLevel(0.20).key === 'Very drunk', '0.20% is Very drunk');
  assert(getIntoxicationLevel(0.35).key === 'Danger', '0.35% is Danger');
  console.log('   ✓ getIntoxicationLevel passed');

  // 6. Test calculateDynamicBAC
  console.log('6. Testing calculateDynamicBAC...');
  const baseTime = new Date('2026-07-06T12:00:00Z');
  const drinks: Drink[] = [
    {
      id: '1',
      type: 'Vodka',
      volumeMl: 50,
      abv: 40,
      quantity: 1,
      time: baseTime.toISOString() // consumed at 12:00
    },
    {
      id: '2',
      type: 'Beer',
      volumeMl: 500,
      abv: 5,
      quantity: 1,
      time: new Date(baseTime.getTime() + 60 * 60 * 1000).toISOString() // consumed at 13:00 (1hr later)
    }
  ];

  // Weight: 80kg, r: 0.68
  // At 12:00, only Vodka consumed:
  // peak vodka BAC = (15.78 / 54400) * 100 = 0.029007%
  const bacAt12 = calculateDynamicBAC(drinks, 80, 0.68, baseTime);
  assertClose(bacAt12, 0.029007, 0.001, 'BAC at 12:00');

  // At 13:00, Vodka has decayed by 1 hour (0.029007 - 0.015 = 0.014007%)
  // Beer is just consumed (peak beer BAC = 19.725 / 54400 * 100 = 0.036259%)
  // Total BAC should be 0.014007 + 0.036259 = 0.050266%
  const time13 = new Date(baseTime.getTime() + 60 * 60 * 1000);
  const bacAt13 = calculateDynamicBAC(drinks, 80, 0.68, time13);
  assertClose(bacAt13, 0.050266, 0.001, 'BAC at 13:00');

  // At 15:00 (3 hours since Vodka, 2 hours since Beer)
  // Vodka decay: 0.029007 - 0.015 * 3 = -0.01599 (clamps to 0)
  // Beer decay: 0.036259 - 0.015 * 2 = 0.006259%
  // Total BAC should be 0 + 0.006259 = 0.006259%
  const time15 = new Date(baseTime.getTime() + 3 * 60 * 60 * 1000);
  const bacAt15 = calculateDynamicBAC(drinks, 80, 0.68, time15);
  assertClose(bacAt15, 0.006259, 0.001, 'BAC at 15:00');

  console.log('   ✓ calculateDynamicBAC passed');

  console.log('\n🎉 ALL UNIT TESTS PASSED SUCCESSFULLY! 🎉\n');
} catch (error: any) {
  console.error('\n❌ UNIT TESTS FAILED!');
  console.error(error.message || error);
  process.exit(1);
}
