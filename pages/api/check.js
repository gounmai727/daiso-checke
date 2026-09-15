import { hasAccess } from "../../lib/checkAccess";

export default function handler(req, res) {
  return res.status(200).json({ ok: hasAccess(req) });
}
