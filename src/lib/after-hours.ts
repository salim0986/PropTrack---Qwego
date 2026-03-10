import { isWithinInterval, setHours, setMinutes, parseISO } from "date-fns";

/**
 * Validates if the current time is strictly within the building's business hours.
 * Uses 8:00 AM to 6:00 PM (18:00) as defaults if undefined.
 */
export function isAfterHours(
    businessHoursStart = 8,
    businessHoursEnd = 18,
    businessDays = [1, 2, 3, 4, 5],
    dateToCheck = new Date()
) {
    const currentDay = dateToCheck.getDay(); // 0 is Sunday, 1 is Monday...

    // If it's a weekend or outside the business days array, it's after hours.
    if (!businessDays.includes(currentDay)) return true;

    const start = setMinutes(setHours(new Date(dateToCheck), businessHoursStart), 0);
    const end = setMinutes(setHours(new Date(dateToCheck), businessHoursEnd), 0);

    return !isWithinInterval(dateToCheck, { start, end });
}
