import assert from 'node:assert/strict';
import test from 'node:test';
import { createNavigationMemory } from '../src/utils/navigationMemory.js';

test('cada visita recupera seus filtros e sua rolagem sem afetar outra visita', () => {
  const memory = createNavigationMemory();
  const month = new Date(2026, 10, 1);
  memory.getValue('list', 'month', month);
  memory.setValue('list', 'month', (previous) => new Date(previous.getFullYear(), 11, 1));
  memory.setScroll('list', { x: 0, y: 1375 });
  memory.getValue('details', 'month', month);

  assert.equal(memory.getValue('list', 'month').getMonth(), 11);
  assert.equal(memory.getValue('details', 'month').getMonth(), 10);
  assert.deepEqual(memory.getScroll('list'), { x: 0, y: 1375 });
  assert.deepEqual(memory.getScroll('details'), { x: 0, y: 0 });
});

test('voltar só usa entradas conhecidas do app e não reabre o login', () => {
  const memory = createNavigationMemory();
  assert.equal(memory.canGoBack(7), false);
  memory.visit(7, 'login', '/login');
  assert.equal(memory.canGoBack(8), false);
  memory.visit(7, 'home', '/');
  memory.visit(8, 'details', '/expense/123');
  memory.visit(9, 'edit', '/expense/new');
  assert.equal(memory.canGoBack(9), true);
  assert.equal(memory.canGoBack(8), true);
  assert.equal(memory.canGoBack(7), false);
});
