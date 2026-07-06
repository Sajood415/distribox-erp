import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function GlobalSearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const result = await window.api.distributor.search(query);
      if (result.success) setResults(result.data.results);
      setOpen(true);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="global-search" style={{ position: "relative", minWidth: 260 }}>
      <input
        className="table-search"
        placeholder="Search invoice, customer, product..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) {
            navigate(results[0].route);
            setOpen(false);
            setQuery("");
          }
        }}
      />
      {open && results.length > 0 && (
        <div className="document-card" style={{ position: "absolute", zIndex: 20, width: "100%", marginTop: 4 }}>
          {results.map((row, index) => (
            <button
              key={`${row.type}-${index}`}
              type="button"
              className="link-button"
              style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 0" }}
              onDoubleClick={() => {
                navigate(row.route);
                setOpen(false);
                setQuery("");
              }}
              onClick={() => {
                navigate(row.route);
                setOpen(false);
                setQuery("");
              }}
            >
              [{row.type}] {row.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
