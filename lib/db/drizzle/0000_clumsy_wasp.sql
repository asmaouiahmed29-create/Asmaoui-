CREATE TABLE "saved_problems" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sector" text NOT NULL,
	"objective_type" text NOT NULL,
	"status" text,
	"optimal_value" numeric,
	"problem_data" jsonb NOT NULL,
	"result" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
