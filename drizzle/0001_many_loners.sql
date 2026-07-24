CREATE TABLE `drink_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`label` text NOT NULL,
	`type` text NOT NULL,
	`volume_ml` real NOT NULL,
	`abv` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `profiles` ADD `food_level` text DEFAULT 'light' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `elimination_rate` real DEFAULT 0.015 NOT NULL;