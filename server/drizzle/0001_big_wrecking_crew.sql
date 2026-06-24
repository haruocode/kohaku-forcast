CREATE TABLE `token_awards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`season_id` text NOT NULL,
	`amount` integer NOT NULL,
	`solana_address` text NOT NULL,
	`tx_signature` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `token_awards_user_season_unq` ON `token_awards` (`user_id`,`season_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `solana_address` text;--> statement-breakpoint
ALTER TABLE `users` ADD `wallet_verified_at` text;