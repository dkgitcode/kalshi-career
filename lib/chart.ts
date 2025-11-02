"use client";

// Centralized Chart.js setup: auto-registers all controllers, elements, scales, and plugins
// so mixed charts (e.g., datasets with type "bar" in a line chart) work without manual registration.
import { Chart as ChartJS } from "chart.js/auto";

export { ChartJS };


