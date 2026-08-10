export const COMMUTE_ASSUMPTIONS = Object.freeze({
  averageWeeksPerMonth: 52 / 12,
  workingWeeksPerYear: 52,
  workingDaysPerWeek: 5,
});

// A disclosed MVP estimate, not tax or payroll advice. Replace with a versioned
// Philippine payroll policy module when authoritative deductions are in scope.
export const TAKE_HOME_ASSUMPTIONS = Object.freeze({ estimatedRate: 0.9 });
