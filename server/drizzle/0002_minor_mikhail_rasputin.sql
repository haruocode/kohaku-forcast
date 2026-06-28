ALTER TABLE `artists` ADD `source` text;--> statement-breakpoint
ALTER TABLE `artists` ADD `external_id` text;--> statement-breakpoint
ALTER TABLE `artists` ADD `image_url` text;--> statement-breakpoint
CREATE UNIQUE INDEX `artists_source_external_unq` ON `artists` (`source`,`external_id`);--> statement-breakpoint
ALTER TABLE `songs` ADD `source` text;--> statement-breakpoint
ALTER TABLE `songs` ADD `external_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `songs_source_external_unq` ON `songs` (`source`,`external_id`);