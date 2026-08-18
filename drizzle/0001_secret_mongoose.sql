CREATE TABLE `applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`candidateId` int NOT NULL,
	`localCouncilId` int NOT NULL,
	`positionId` int NOT NULL,
	`status` enum('Pending','Interview Scheduled','Selected','Rejected','No-Show','Clarify') NOT NULL DEFAULT 'Pending',
	`appliedAt` timestamp NOT NULL DEFAULT (now()),
	`shortlistedAt` timestamp,
	`rejectedAt` timestamp,
	`selectedAt` timestamp,
	`rejectionReason` text,
	`clarificationNotes` text,
	`interviewNotes` text,
	`screeningNotes` text,
	`reminderSent` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(255) NOT NULL,
	`entityType` varchar(100),
	`entityId` int,
	`changes` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`fullName` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`personalEmail` varchar(320),
	`universityEmail` varchar(320),
	`phone` varchar(20),
	`whatsappNumber` varchar(20),
	`university` varchar(255),
	`courseOfStudy` varchar(255),
	`yearOfStudy` varchar(50),
	`facebookUrl` text,
	`instagramHandle` varchar(255),
	`linkedinUrl` text,
	`twitterHandle` varchar(255),
	`inNationalWhatsapp` enum('Yes','No','Not Yet'),
	`resumeUrl` text,
	`resumeKey` varchar(255),
	`coverLetterUrl` text,
	`coverLetterKey` varchar(255),
	`additionalDocumentUrl` text,
	`additionalDocumentKey` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `candidates_id` PRIMARY KEY(`id`),
	CONSTRAINT `candidates_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `configuration` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`dataType` enum('string','number','boolean','json') DEFAULT 'string',
	`description` text,
	`category` varchar(100),
	`isSecret` boolean DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `configuration_id` PRIMARY KEY(`id`),
	CONSTRAINT `configuration_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`candidateId` int NOT NULL,
	`applicationId` int,
	`type` enum('Appointment Letter','Certificate','Bylaws','Toolkit') NOT NULL,
	`documentUrl` text NOT NULL,
	`documentKey` varchar(255) NOT NULL,
	`fileName` varchar(255),
	`mimeType` varchar(100),
	`fileSize` int,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`accessCount` int DEFAULT 0,
	`lastAccessedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emailQueue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`emailType` varchar(100) NOT NULL,
	`htmlBody` text NOT NULL,
	`ccEmails` text,
	`documentIds` json,
	`contextData` json,
	`retryCount` int NOT NULL DEFAULT 0,
	`maxRetries` int NOT NULL DEFAULT 3,
	`status` enum('Pending','Sent','Failed','Permanent Failure') DEFAULT 'Pending',
	`lastAttemptAt` timestamp,
	`sentAt` timestamp,
	`failureReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emailQueue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int NOT NULL,
	`interviewerUserId` int,
	`interviewerEmail` varchar(320),
	`scheduledAt` datetime NOT NULL,
	`endTime` datetime,
	`meetLink` text,
	`googleCalendarEventId` varchar(255),
	`status` enum('Scheduled','Completed','No-Show','Rescheduled') DEFAULT 'Scheduled',
	`feedbackSubmitted` boolean DEFAULT false,
	`feedbackJson` json,
	`communicationScore` int,
	`knowledgeScore` int,
	`leadershipScore` int,
	`motivationScore` int,
	`professionalismScore` int,
	`overallRecommendation` varchar(100),
	`strengths` text,
	`areasForImprovement` text,
	`feedbackNotes` text,
	`invitationSentAt` timestamp,
	`reminderSentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `interviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lcPositionStatus` (
	`id` int AUTO_INCREMENT NOT NULL,
	`localCouncilId` int NOT NULL,
	`positionId` int NOT NULL,
	`filledBy` int,
	`filledByName` varchar(255),
	`status` enum('Vacant','Filled','In Progress') DEFAULT 'Vacant',
	`filledAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lcPositionStatus_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `localCouncils` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`shortCode` varchar(50) NOT NULL,
	`email` varchar(320),
	`university` varchar(255),
	`city` varchar(100),
	`country` varchar(100),
	`whatsappLink` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `localCouncils_id` PRIMARY KEY(`id`),
	CONSTRAINT `localCouncils_name_unique` UNIQUE(`name`),
	CONSTRAINT `localCouncils_shortCode_unique` UNIQUE(`shortCode`)
);
--> statement-breakpoint
CREATE TABLE `onboarding` (
	`id` int AUTO_INCREMENT NOT NULL,
	`candidateId` int NOT NULL,
	`applicationId` int NOT NULL,
	`selectionDate` timestamp NOT NULL,
	`email1DueAt` timestamp NOT NULL,
	`email1SentAt` timestamp,
	`email2DueAt` timestamp NOT NULL,
	`email2SentAt` timestamp,
	`email3DueAt` timestamp NOT NULL,
	`email3SentAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `onboarding_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `positions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`shortCode` varchar(50) NOT NULL,
	`tier` enum('EB','Officials') NOT NULL,
	`description` text,
	`department` varchar(100),
	`email` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `positions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','lc_admin','candidate') NOT NULL DEFAULT 'candidate';--> statement-breakpoint
ALTER TABLE `users` ADD `localCouncilId` int;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);