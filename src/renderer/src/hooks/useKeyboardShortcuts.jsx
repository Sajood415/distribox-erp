import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const SHORTCUTS = [
  { keys: "Ctrl + /", action: "Show keyboard shortcuts" },
  { keys: "Ctrl + D", action: "Go to Dashboard" },
  { keys: "Ctrl + Shift + S", action: "New Sales Invoice" },
  { keys: "Ctrl + Shift + P", action: "New Purchase Invoice" },
  { keys: "Ctrl + Shift + R", action: "Recovery" },
  { keys: "Ctrl + Shift + V", action: "New Voucher" },
  { keys: "Ctrl + Shift + T", action: "Reports" },
];

export default function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    function onKeyDown(event) {
      const target = event.target;
      const tag = target?.tagName?.toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;

      if (event.ctrlKey && event.key === "/") {
        event.preventDefault();
        setShowHelp((current) => !current);
        return;
      }

      if (typing) {
        return;
      }

      if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        navigate("/dashboard");
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        navigate("/sales/invoices/new");
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        navigate("/purchase/invoices/new");
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        navigate("/sales/recovery");
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "v") {
        event.preventDefault();
        navigate("/accounting/vouchers/new");
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "t") {
        event.preventDefault();
        navigate("/reports");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  const helpModal = showHelp ? (
    <div className="modal-backdrop" onClick={() => setShowHelp(false)}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>Keyboard Shortcuts</h3>
        <table className="data-table compact">
          <thead>
            <tr>
              <th>Shortcut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.map((item) => (
              <tr key={item.keys}>
                <td>
                  <code>{item.keys}</code>
                </td>
                <td>{item.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="document-actions">
          <button type="button" onClick={() => setShowHelp(false)}>
            Close
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { helpModal, setShowHelp };
}
