ALTER TABLE "lesson_progress" ADD COLUMN "quiz_passed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "lesson_progress" ADD COLUMN "quiz_answers" JSONB;

UPDATE "lesson_progress" SET "lesson_id" = 'beginner-7' WHERE "lesson_id" = 'fund-1';

-- Conclusão antiga era só um clique. Sem o teste certo, a aula não conta.
UPDATE "lesson_progress" SET "completed" = false WHERE "quiz_passed" = false;
