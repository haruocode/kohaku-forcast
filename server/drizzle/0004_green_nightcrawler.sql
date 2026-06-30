CREATE TABLE `point_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`balance_after` integer NOT NULL,
	`ref_id` text,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_predictions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`season_id` text NOT NULL,
	`artist_id` text NOT NULL,
	`song_id` text,
	`confidence` integer,
	`stake` integer DEFAULT 0 NOT NULL,
	`settled` integer DEFAULT false NOT NULL,
	`payout` integer,
	`comment` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_predictions`("id", "user_id", "season_id", "artist_id", "song_id", "confidence", "stake", "settled", "payout", "comment", "created_at", "updated_at") SELECT "id", "user_id", "season_id", "artist_id", "song_id", "confidence", "stake", "settled", "payout", "comment", "created_at", "updated_at" FROM `predictions`;--> statement-breakpoint
DROP TABLE `predictions`;--> statement-breakpoint
ALTER TABLE `__new_predictions` RENAME TO `predictions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `predictions_user_season_artist_unq` ON `predictions` (`user_id`,`season_id`,`artist_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `points` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `last_daily_bonus_date` text;