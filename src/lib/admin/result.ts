export type ActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export const initialResult: ActionResult = { ok: false };
