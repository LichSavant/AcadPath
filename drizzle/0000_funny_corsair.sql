CREATE TABLE `student_records` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`document` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
