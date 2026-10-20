// Apply the saved or system theme before first paint to avoid a flash. External file so the strict CSP stays intact.
try {
  var t = localStorage.getItem("cr-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = t;
} catch (e) {}
