import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import {
  CreateProfileItemBody,
  DeleteProfileItemParams,
  UpdateProfileItemBody,
  UpdateProfileItemParams,
} from "@workspace/api-zod";
import { db, profileItemsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

/**
 * 이력 항목 (자격증·어학·프로젝트·수상/공모전·대외활동·경력·교육) — 한 번 등록해 두고 여러 이력서에 골라 넣는다.
 */
const router: IRouter = Router();

function serialize(item: typeof profileItemsTable.$inferSelect) {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    organization: item.organization ?? null,
    startDate: item.startDate ?? null,
    endDate: item.endDate ?? null,
    score: item.score ?? null,
    description: item.description ?? null,
    url: item.url ?? null,
    createdAt: item.createdAt.toISOString(),
  };
}

/** 빈 문자열은 지우기(null)로, 앞뒤 공백은 정리한다. */
function clean(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

const OPTIONAL_FIELDS = ["organization", "startDate", "endDate", "score", "description", "url"] as const;

router.get("/profile-items", requireAuth, async (req, res): Promise<void> => {
  const items = await db.select().from(profileItemsTable)
    .where(eq(profileItemsTable.userId, req.session.userId!))
    .orderBy(asc(profileItemsTable.kind), asc(profileItemsTable.startDate), asc(profileItemsTable.id));
  res.json(items.map(serialize));
});

router.post("/profile-items", requireAuth, async (req, res): Promise<void> => {
  const input = CreateProfileItemBody.safeParse(req.body);
  if (!input.success || !input.data.title.trim()) {
    res.status(400).json({ error: "항목 종류와 이름을 확인해주세요." });
    return;
  }
  const values: typeof profileItemsTable.$inferInsert = {
    userId: req.session.userId!,
    kind: input.data.kind,
    title: input.data.title.trim(),
  };
  for (const field of OPTIONAL_FIELDS) values[field] = clean(input.data[field]) ?? null;
  const [item] = await db.insert(profileItemsTable).values(values).returning();
  res.status(201).json(serialize(item));
});

router.patch("/profile-items/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateProfileItemParams.safeParse(req.params);
  const input = UpdateProfileItemBody.safeParse(req.body);
  if (!params.success || !input.success) { res.status(400).json({ error: "입력값을 확인해주세요." }); return; }
  const update: Partial<typeof profileItemsTable.$inferInsert> = {};
  if (input.data.kind !== undefined) update.kind = input.data.kind;
  if (input.data.title !== undefined) {
    const title = input.data.title.trim();
    if (!title) { res.status(400).json({ error: "항목 이름을 입력해주세요." }); return; }
    update.title = title;
  }
  for (const field of OPTIONAL_FIELDS) {
    const value = clean(input.data[field]);
    if (value !== undefined) update[field] = value;
  }
  if (Object.keys(update).length === 0) { res.status(400).json({ error: "수정할 항목이 없습니다." }); return; }
  const [item] = await db.update(profileItemsTable).set(update)
    .where(and(eq(profileItemsTable.id, params.data.id), eq(profileItemsTable.userId, req.session.userId!)))
    .returning();
  if (!item) { res.status(404).json({ error: "항목을 찾을 수 없습니다." }); return; }
  res.json(serialize(item));
});

router.delete("/profile-items/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteProfileItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "유효하지 않은 ID입니다." }); return; }
  const deleted = await db.delete(profileItemsTable)
    .where(and(eq(profileItemsTable.id, params.data.id), eq(profileItemsTable.userId, req.session.userId!)))
    .returning({ id: profileItemsTable.id });
  if (deleted.length === 0) { res.status(404).json({ error: "항목을 찾을 수 없습니다." }); return; }
  res.status(204).end();
});

export default router;
