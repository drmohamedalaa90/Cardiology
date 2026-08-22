const $ = (id) => document.getElementById(id);

function showBootError(message) {
  const area = $("quizArea");
  const status = $("saveStatus");

  if (status) {
    status.textContent = "Learning engine error";
    status.style.color = "#b4232b";
  }

  if (area) {
    area.innerHTML = `
      <div style="
        padding:22px;
        border:1px solid #f0c7cb;
        border-radius:14px;
        background:#fff7f8;
        color:#8d2029;
        text-align:center;
      ">
        <strong style="display:block;margin-bottom:6px">
          Learning Mode could not start
        </strong>
        <div style="font-size:13px;line-height:1.45">
          ${String(message || "Unknown loading error")}
        </div>
        <button
          type="button"
          onclick="location.reload()"
          style="
            margin-top:14px;
            min-height:38px;
            padding:0 14px;
            border:1px solid #d9aeb2;
            border-radius:8px;
            background:#fff;
            color:#7b2027;
            font-weight:800;
            cursor:pointer;
          "
        >
          Retry
        </button>
      </div>
    `;
  }
}

function setStage(text) {
  const status = $("saveStatus");
  if (status) status.textContent = text;
}

setStage("Starting learning engine…");

const importPromise = import(
  "./learning-mode.js?v=20260822-lifesavers2"
);

const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => {
    reject(
      new Error(
        "Learning engine import timed out. A required JavaScript dependency did not load."
      )
    );
  }, 10000);
});

Promise.race([importPromise, timeoutPromise])
  .then(() => {
    console.log("ACL LEARNING BOOTSTRAP: engine imported");
  })
  .catch((error) => {
    console.error("ACL LEARNING BOOTSTRAP ERROR:", error);
    showBootError(error?.message || String(error));
  });

window.addEventListener("error", (event) => {
  if (/learning|session-ui|cloud-progress|user-settings/i.test(event?.filename || "")) {
    showBootError(event.message || "JavaScript loading error");
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event?.reason;
  const text =
    reason?.message ||
    (typeof reason === "string" ? reason : "");

  if (text) {
    console.error("ACL LEARNING UNHANDLED REJECTION:", reason);
  }
});
