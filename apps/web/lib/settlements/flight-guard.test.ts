import { describe, expect, it } from "vitest";
import { createFlightGuard } from "./flight-guard";

describe("createFlightGuard", () => {
  it("starts one task for rapid repeated calls before the first finishes", async () => {
    const run = createFlightGuard();
    let started = 0;
    let finish!: () => void;
    const task = () => {
      started += 1;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    };
    run(task);
    run(task);
    run(task);
    expect(started).toBe(1);
    finish();
    await new Promise((r) => setTimeout(r, 0));
    run(task);
    expect(started).toBe(2);
  });

  it("is shared by different tasks (approve blocks reject)", () => {
    const run = createFlightGuard();
    let rejected = 0;
    run(() => new Promise<void>(() => {}));
    run(async () => {
      rejected += 1;
    });
    expect(rejected).toBe(0);
  });

  it("releases after a failed task and does not leak the rejection", async () => {
    const run = createFlightGuard();
    run(() => Promise.reject(new Error("boom")));
    await new Promise((r) => setTimeout(r, 0));
    let ran = false;
    run(async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });

  it("releases when the task throws synchronously", () => {
    const run = createFlightGuard();
    expect(() =>
      run(() => {
        throw new Error("sync");
      }),
    ).not.toThrow();
    let ran = false;
    run(async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });
});
