import assert from "node:assert/strict";
import test from "node:test";
import { LoadingCoordinator } from "../src/lib/loading-coordinator.mjs";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

test("does not show for an operation faster than the display delay", async () => {
  const states = [];
  const coordinator = new LoadingCoordinator({
    onChange: (state) => states.push(state),
    showDelayMs: 20,
    minimumVisibleMs: 25,
    defaultTimeoutMs: 200,
  });

  const finish = coordinator.begin("Consulta rápida");
  finish();
  await wait(30);

  assert.equal(coordinator.getState().visible, false);
  assert.equal(states.some((state) => state.visible), false);
  coordinator.dispose();
});

test("keeps the animation visible for the configured minimum duration", async () => {
  const coordinator = new LoadingCoordinator({
    onChange: () => undefined,
    showDelayMs: 5,
    minimumVisibleMs: 35,
    defaultTimeoutMs: 200,
  });

  const finish = coordinator.begin("Consulta lenta");
  await wait(12);
  assert.equal(coordinator.getState().visible, true);

  finish();
  assert.equal(coordinator.getState().visible, true);
  await wait(40);
  assert.equal(coordinator.getState().visible, false);
  coordinator.dispose();
});

test("waits for every concurrent operation to finish", async () => {
  const coordinator = new LoadingCoordinator({
    onChange: () => undefined,
    showDelayMs: 5,
    minimumVisibleMs: 10,
    defaultTimeoutMs: 200,
  });

  const finishFirst = coordinator.begin("Primeira consulta");
  const finishSecond = coordinator.begin("Segunda consulta");
  await wait(12);

  finishFirst();
  assert.equal(coordinator.getState().activeCount, 1);
  assert.equal(coordinator.getState().visible, true);

  finishSecond();
  await wait(15);
  assert.equal(coordinator.getState().activeCount, 0);
  assert.equal(coordinator.getState().visible, false);
  coordinator.dispose();
});

test("finish callbacks are idempotent", () => {
  const coordinator = new LoadingCoordinator({
    onChange: () => undefined,
    showDelayMs: 20,
    minimumVisibleMs: 20,
    defaultTimeoutMs: 200,
  });

  const finish = coordinator.begin();
  finish();
  finish();

  assert.equal(coordinator.getState().activeCount, 0);
  coordinator.dispose();
});

test("safety timeout releases a stuck operation", async () => {
  const timedOut = [];
  const coordinator = new LoadingCoordinator({
    onChange: () => undefined,
    onTimeout: (label) => timedOut.push(label),
    showDelayMs: 5,
    minimumVisibleMs: 5,
    defaultTimeoutMs: 20,
  });

  coordinator.begin("Operação travada");
  await wait(35);

  assert.deepEqual(timedOut, ["Operação travada"]);
  assert.equal(coordinator.getState().activeCount, 0);
  coordinator.dispose();
});
