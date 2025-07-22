const themeSelect = document.getElementById("theme-select");

window.addEventListener("load", () => {
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.body.classList.add(`theme-${savedTheme}`);
  themeSelect.value = savedTheme;
});

themeSelect.addEventListener("change", (e) => {
  const selectedTheme = e.target.value;

  document.body.className = document.body.className
    .split(" ")
    .filter(cls => !cls.startsWith("theme-"))
    .join(" ");

  document.body.classList.add(`theme-${selectedTheme}`);
  localStorage.setItem("theme", selectedTheme);
});