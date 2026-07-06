import { useSearchParams } from "react-router-dom";

export default function useDocIdHighlight() {
  const [params] = useSearchParams();
  const docId = params.get("docId");
  if (!docId) return null;
  const parsed = Number(docId);
  return Number.isFinite(parsed) ? parsed : null;
}
