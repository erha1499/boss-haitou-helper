export function showNotification(message, type = "success") {
  const notification = document.createElement("div");
  notification.className = `zdl-notify ${type === "success" ? "success" : "error"}`;
  notification.setAttribute("role", type === "success" ? "status" : "alert");
  notification.textContent = message;
  document.body.appendChild(notification);

  requestAnimationFrame(() => notification.classList.add("show"));
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, type === "success" ? 2200 : 3500);
}
