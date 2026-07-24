CREATE TABLE `drinking_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`status` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text,
	`max_bac` real DEFAULT 0 NOT NULL,
	`duration_hours` real DEFAULT 0 NOT NULL,
	`total_alcohol_grams` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `drinks` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`user_email` text NOT NULL,
	`type` text NOT NULL,
	`volume_ml` real NOT NULL,
	`abv` real NOT NULL,
	`quantity` real NOT NULL,
	`consumed_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `drinking_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_email` text PRIMARY KEY NOT NULL,
	`weight_kg` real NOT NULL,
	`height_cm` real NOT NULL,
	`age` real NOT NULL,
	`gender` text NOT NULL,
	`widmark_factor` real NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
