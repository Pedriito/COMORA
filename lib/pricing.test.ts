import { describe, expect, it } from "vitest";
import { annualTotal, displayedMonthly, formatEuros } from "./pricing";

describe("tarifs annuels", () => {
  it.each([
    [19, 182.4],
    [49, 470.4],
    [119, 1142.4],
    [12, 115.2],
    [29, 278.4],
    [69, 662.4],
  ])("%d € par mois → %d € par an (−20 %%)", (monthly, annual) => {
    expect(annualTotal(monthly)).toBe(annual);
  });

  it("répartit le total annuel sur 12 mois, sans arrondir en amont", () => {
    expect(displayedMonthly(19, true) * 12).toBeCloseTo(182.4, 10);
    expect(displayedMonthly(19, false)).toBe(19);
  });

  it("n'affiche des décimales que si nécessaire", () => {
    expect(formatEuros(19)).toBe("19");
    expect(formatEuros(15.2)).toBe("15,20");
    expect(formatEuros(182.4).replace(/\s/g, " ")).toBe("182,40");
    expect(formatEuros(1142.4).replace(/\s/g, " ")).toBe("1 142,40");
  });
});
