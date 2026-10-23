CREATE TABLE "user_places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"data" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"client_updated_at" timestamp with time zone,
	"server_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_places_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "user_places" ADD CONSTRAINT "user_places_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;