/**
 * Comprehensive E2E tests for parse-prd command
 * Tests all aspects of PRD parsing including different formats and error handling
 */

export default async function testParsePrd(logger, helpers, context) {
	const { testDir } = context;
	const results = {
		status: 'passed',
		errors: [],
		tests: []
	};

	async function runTest(name, testFn) {
		try {
			logger.info(`\nRunning: ${name}`);
			await testFn();
			results.tests.push({ name, status: 'passed' });
			logger.success(`✓ ${name}`);
		} catch (error) {
			results.tests.push({ name, status: 'failed', error: error.message });
			results.errors.push({ test: name, error: error.message });
			logger.error(`✗ ${name}: ${error.message}`);
		}
	}

	try {
		logger.info('Starting comprehensive parse-prd tests...');

		// Test 1: Basic PRD parsing from file
		await runTest('Basic PRD parsing', async () => {
			// Create a simple PRD file
			const prdContent = `# Product Requirements Document

## Overview
Build a task management system for developers.

## Features
1. Create and manage tasks
2. Set task dependencies
3. Track task status
4. Generate reports

## Technical Requirements
- Node.js backend
- RESTful API
- JSON data storage
- CLI interface

## User Stories
As a developer, I want to:
- Create tasks quickly from the command line
- View my task list with priorities
- Mark tasks as complete
- See task dependencies`;

			helpers.writeFile(`${testDir}/simple-prd.txt`, prdContent);
			
			const result = await helpers.taskMaster(
				'parse-prd',
				['simple-prd.txt'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Check for success message
			if (!result.stdout.includes('task') || !result.stdout.includes('created')) {
				throw new Error('PRD parsing did not report task creation');
			}
			
			// Verify tasks were created
			const listResult = await helpers.taskMaster('list', [], { cwd: testDir });
			if (!listResult.stdout.includes('Create and manage tasks') && 
			    !listResult.stdout.includes('task')) {
				throw new Error('Tasks from PRD not found in task list');
			}
		});

		// Test 2: PRD parsing with complex structure
		await runTest('Complex PRD parsing', async () => {
			const complexPrd = `<PRD>
# E-Commerce Platform PRD

## Executive Summary
A comprehensive e-commerce platform with multi-vendor support.

## Core Features
### User Management
- User registration and authentication
- Role-based access control
- User profiles and preferences

### Product Catalog
- Product listing and search
- Categories and filters
- Product reviews and ratings

### Shopping Cart
- Add/remove items
- Save for later
- Apply discount codes

### Payment Processing
- Multiple payment methods
- Secure checkout
- Order confirmation

## Technical Architecture
### Frontend
- React.js with TypeScript
- Responsive design
- Progressive Web App

### Backend
- Node.js with Express
- PostgreSQL database
- Redis for caching

### Infrastructure
- Docker containers
- Kubernetes orchestration
- CI/CD pipeline

## Development Phases
Phase 1: Core infrastructure and user management
Phase 2: Product catalog and search
Phase 3: Shopping cart and checkout
Phase 4: Payment integration
Phase 5: Admin dashboard

## Dependencies
- User management must be complete before any other features
- Product catalog required before shopping cart
- Shopping cart required before payment processing
</PRD>`;

			helpers.writeFile(`${testDir}/complex-prd.md`, complexPrd);
			
			const result = await helpers.taskMaster(
				'parse-prd',
				['complex-prd.md'],
				{ cwd: testDir, timeout: 180000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should create multiple tasks
			const taskCountMatch = result.stdout.match(/(\d+) tasks? created/i);
			if (!taskCountMatch || parseInt(taskCountMatch[1]) < 5) {
				throw new Error('Complex PRD should create more tasks');
			}
			
			// Check for phase-based tasks
			const listResult = await helpers.taskMaster('list', [], { cwd: testDir });
			if (!listResult.stdout.includes('Phase') && !listResult.stdout.includes('phase')) {
				throw new Error('Phase-based tasks not created from PRD');
			}
		});

		// Test 3: PRD parsing with custom task template
		await runTest('PRD parsing with task template', async () => {
			const templatePrd = `# Project: API Development

## Tasks
[TASK] Design RESTful API endpoints
- Define resource models
- Document API specifications
- Create OpenAPI schema

[TASK] Implement authentication
- JWT token generation
- Refresh token mechanism
- Role-based permissions

[TASK] Build core endpoints
- CRUD operations for resources
- Input validation
- Error handling

[TASK] Add caching layer
- Redis integration
- Cache invalidation strategy
- Performance monitoring`;

			helpers.writeFile(`${testDir}/template-prd.txt`, templatePrd);
			
			const result = await helpers.taskMaster(
				'parse-prd',
				['template-prd.txt', '--template', '[TASK]'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should recognize custom template
			const listResult = await helpers.taskMaster('list', [], { cwd: testDir });
			if (!listResult.stdout.includes('Design RESTful API') ||
			    !listResult.stdout.includes('authentication')) {
				throw new Error('Custom template tasks not parsed correctly');
			}
		});

		// Test 4: Incremental PRD update
		await runTest('Incremental PRD update', async () => {
			// First PRD
			const initialPrd = `# Initial Requirements

## Phase 1
- Setup project structure
- Configure development environment`;

			helpers.writeFile(`${testDir}/incremental-prd.txt`, initialPrd);
			
			// Parse initial PRD
			await helpers.taskMaster(
				'parse-prd',
				['incremental-prd.txt'],
				{ cwd: testDir }
			);
			
			// Get initial task count
			const initialList = await helpers.taskMaster('list', [], { cwd: testDir });
			const initialTaskCount = (initialList.stdout.match(/\d+\s*\|/g) || []).length;
			
			// Update PRD with additional content
			const updatedPrd = `# Initial Requirements

## Phase 1
- Setup project structure
- Configure development environment

## Phase 2 (NEW)
- Implement user authentication
- Create database schema
- Build API endpoints`;

			helpers.writeFile(`${testDir}/incremental-prd.txt`, updatedPrd);
			
			// Parse updated PRD
			const result = await helpers.taskMaster(
				'parse-prd',
				['incremental-prd.txt', '--update'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should add new tasks without duplicating existing ones
			const updatedList = await helpers.taskMaster('list', [], { cwd: testDir });
			const updatedTaskCount = (updatedList.stdout.match(/\d+\s*\|/g) || []).length;
			
			if (updatedTaskCount <= initialTaskCount) {
				throw new Error('Incremental update did not add new tasks');
			}
			
			if (!updatedList.stdout.includes('authentication') || 
			    !updatedList.stdout.includes('Phase 2')) {
				throw new Error('New phase tasks not added');
			}
		});

		// Test 5: PRD parsing with dependencies
		await runTest('PRD with explicit dependencies', async () => {
			const dependencyPrd = `# Project with Dependencies

## Tasks and Dependencies

### 1. Database Setup
No dependencies

### 2. User Model
Depends on: Database Setup

### 3. Authentication Service
Depends on: User Model

### 4. API Endpoints
Depends on: Authentication Service, User Model

### 5. Frontend Integration
Depends on: API Endpoints

## Additional Notes
Tasks should be completed in dependency order.`;

			helpers.writeFile(`${testDir}/dependency-prd.txt`, dependencyPrd);
			
			const result = await helpers.taskMaster(
				'parse-prd',
				['dependency-prd.txt'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify dependencies were set
			const listResult = await helpers.taskMaster('list', [], { cwd: testDir });
			const taskIds = {};
			
			// Extract task IDs
			const lines = listResult.stdout.split('\n');
			lines.forEach(line => {
				if (line.includes('Database Setup')) {
					const match = line.match(/(\d+)\s*\|/);
					if (match) taskIds.database = match[1];
				} else if (line.includes('User Model')) {
					const match = line.match(/(\d+)\s*\|/);
					if (match) taskIds.userModel = match[1];
				}
			});
			
			// Check dependency relationships
			if (taskIds.userModel && taskIds.database) {
				const showResult = await helpers.taskMaster('show', [taskIds.userModel], { cwd: testDir });
				if (!showResult.stdout.includes(taskIds.database)) {
					throw new Error('Dependencies not properly set from PRD');
				}
			}
		});

		// Test 6: Error handling - non-existent file
		await runTest('Error handling - non-existent file', async () => {
			const result = await helpers.taskMaster(
				'parse-prd',
				['non-existent-prd.txt'],
				{ cwd: testDir, allowFailure: true }
			);
			if (result.exitCode === 0) {
				throw new Error('Should have failed with non-existent file');
			}
			if (!result.stderr.includes('not found') && !result.stderr.includes('exist')) {
				throw new Error('Error message does not indicate file not found');
			}
		});

		// Test 7: Error handling - malformed PRD
		await runTest('Error handling - malformed PRD', async () => {
			const malformedPrd = `This is not a valid PRD format
			
Random text without structure
No headers or sections
Just plain text`;

			helpers.writeFile(`${testDir}/malformed-prd.txt`, malformedPrd);
			
			const result = await helpers.taskMaster(
				'parse-prd',
				['malformed-prd.txt'],
				{ cwd: testDir, allowFailure: true }
			);
			
			// Should either fail or create minimal tasks
			if (result.exitCode === 0) {
				// If it succeeds, should create at least one task
				const listResult = await helpers.taskMaster('list', [], { cwd: testDir });
				const taskCount = (listResult.stdout.match(/\d+\s*\|/g) || []).length;
				if (taskCount === 0) {
					throw new Error('No tasks created from malformed PRD');
				}
			}
		});

		// Test 8: PRD parsing with different formats
		await runTest('PRD parsing - JSON format', async () => {
			const jsonPrd = {
				"project": "Mobile App Development",
				"features": [
					{
						"name": "User Authentication",
						"tasks": [
							"Design login UI",
							"Implement OAuth integration",
							"Add biometric authentication"
						]
					},
					{
						"name": "Data Synchronization",
						"tasks": [
							"Implement offline mode",
							"Create sync engine",
							"Handle conflict resolution"
						]
					}
				],
				"technical": {
					"platform": "React Native",
					"backend": "Firebase"
				}
			};

			helpers.writeFile(`${testDir}/json-prd.json`, JSON.stringify(jsonPrd, null, 2));
			
			const result = await helpers.taskMaster(
				'parse-prd',
				['json-prd.json'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify tasks from JSON were created
			const listResult = await helpers.taskMaster('list', [], { cwd: testDir });
			if (!listResult.stdout.includes('Authentication') || 
			    !listResult.stdout.includes('Synchronization')) {
				throw new Error('JSON PRD features not parsed correctly');
			}
		});

		// Test 9: PRD with markdown formatting
		await runTest('PRD with rich markdown', async () => {
			const markdownPrd = `# **Project**: Developer Tools Suite

## 🎯 Goals
- Increase developer productivity
- Automate repetitive tasks
- Improve code quality

## 📋 Features

### Code Analysis Tool
- [ ] Static code analysis
- [ ] Security vulnerability scanning
- [ ] Performance profiling
- [ ] Code complexity metrics

### Documentation Generator
1. **Auto-generate API docs** from code comments
2. **Create architecture diagrams** from codebase
3. **Generate changelog** from git history

### Testing Framework
| Feature | Priority | Effort |
|---------|----------|--------|
| Unit test generation | High | Medium |
| Integration test templates | Medium | Low |
| Load testing suite | Low | High |

## 🔗 Links
- [Design Docs](https://example.com/design)
- [API Specs](https://example.com/api)

## ⚠️ Constraints
- Must support multiple programming languages
- Should integrate with existing CI/CD pipelines
- Performance impact < 5% on build times`;

			helpers.writeFile(`${testDir}/markdown-prd.md`, markdownPrd);
			
			const result = await helpers.taskMaster(
				'parse-prd',
				['markdown-prd.md'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Check parsing handled markdown elements
			const listResult = await helpers.taskMaster('list', [], { cwd: testDir });
			if (!listResult.stdout.includes('Code Analysis') || 
			    !listResult.stdout.includes('Documentation Generator')) {
				throw new Error('Markdown formatting interfered with parsing');
			}
		});

		// Test 10: Large PRD performance test
		await runTest('Performance - large PRD', async () => {
			// Generate a large PRD
			let largePrd = `# Large Enterprise System PRD\n\n`;
			
			for (let i = 1; i <= 20; i++) {
				largePrd += `## Module ${i}: ${['User', 'Product', 'Order', 'Payment', 'Shipping'][i % 5]} Management\n\n`;
				largePrd += `### Features\n`;
				for (let j = 1; j <= 5; j++) {
					largePrd += `- Feature ${i}.${j}: Implement ${['CRUD', 'Search', 'Filter', 'Export', 'Import'][j-1]} functionality\n`;
				}
				largePrd += `\n### Technical Requirements\n`;
				largePrd += `- Database tables for module ${i}\n`;
				largePrd += `- API endpoints for module ${i}\n`;
				largePrd += `- Unit tests for module ${i}\n\n`;
			}

			helpers.writeFile(`${testDir}/large-prd.txt`, largePrd);
			
			const startTime = Date.now();
			const result = await helpers.taskMaster(
				'parse-prd',
				['large-prd.txt'],
				{ cwd: testDir, timeout: 300000 }
			);
			const duration = Date.now() - startTime;
			
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			logger.info(`Large PRD parsed in ${duration}ms`);
			
			// Should create many tasks
			const taskCountMatch = result.stdout.match(/(\d+) tasks? created/i);
			const taskCount = taskCountMatch ? parseInt(taskCountMatch[1]) : 0;
			
			if (taskCount < 20) {
				throw new Error(`Large PRD should create more tasks (got ${taskCount})`);
			}
			logger.info(`Created ${taskCount} tasks from large PRD`);
		});

		// Test 11: PRD with images and diagrams references
		await runTest('PRD with external references', async () => {
			const referencePrd = `# System Architecture PRD

## Overview
See architecture diagram: ![Architecture](./diagrams/system-arch.png)

## Features
Based on the wireframes in /designs/wireframes/:

1. Dashboard (see dashboard-wireframe.png)
   - Real-time metrics display
   - Customizable widgets
   - Export functionality

2. User Management (see user-flow.pdf)
   - CRUD operations
   - Role assignment
   - Activity logging

## API Design
Refer to swagger.yaml for detailed API specifications.

## Database Schema
See database-schema.sql for table definitions.`;

			helpers.writeFile(`${testDir}/reference-prd.md`, referencePrd);
			
			const result = await helpers.taskMaster(
				'parse-prd',
				['reference-prd.md'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should parse content despite external references
			const listResult = await helpers.taskMaster('list', [], { cwd: testDir });
			if (!listResult.stdout.includes('Dashboard') || 
			    !listResult.stdout.includes('User Management')) {
				throw new Error('Failed to parse PRD with external references');
			}
		});

		// Test 12: PRD parsing with priority hints
		await runTest('PRD with priority indicators', async () => {
			const priorityPrd = `# Project Roadmap

## Critical Features (P0)
- Security authentication system
- Data encryption at rest
- Audit logging

## High Priority (P1)
- User dashboard
- Reporting module
- API rate limiting

## Medium Priority (P2)
- Dark mode support
- Export to PDF
- Batch operations

## Nice to Have (P3)
- Theme customization
- Advanced analytics
- Third-party integrations`;

			helpers.writeFile(`${testDir}/priority-prd.txt`, priorityPrd);
			
			const result = await helpers.taskMaster(
				'parse-prd',
				['priority-prd.txt'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Check if priorities were recognized
			// Get task details to verify priority assignment
			const listResult = await helpers.taskMaster('list', [], { cwd: testDir });
			
			// Find a critical task
			const lines = listResult.stdout.split('\n');
			let criticalTaskId = null;
			lines.forEach(line => {
				if (line.includes('Security authentication') || line.includes('encryption')) {
					const match = line.match(/(\d+)\s*\|/);
					if (match) criticalTaskId = match[1];
				}
			});
			
			if (criticalTaskId) {
				const showResult = await helpers.taskMaster('show', [criticalTaskId], { cwd: testDir });
				// Check if it has high priority
				if (!showResult.stdout.includes('high') && !showResult.stdout.includes('High')) {
					logger.warning('Critical tasks may not have been assigned high priority');
				}
			}
		});

		// Test 13: Multiple PRD files
		await runTest('Parse multiple PRD files', async () => {
			// Create multiple PRD files
			const prd1 = `# Frontend Requirements
- Build responsive UI
- Implement state management
- Add unit tests`;

			const prd2 = `# Backend Requirements
- Design REST API
- Setup database
- Implement caching`;

			helpers.writeFile(`${testDir}/frontend-prd.txt`, prd1);
			helpers.writeFile(`${testDir}/backend-prd.txt`, prd2);
			
			const result = await helpers.taskMaster(
				'parse-prd',
				['frontend-prd.txt', 'backend-prd.txt'],
				{ cwd: testDir, timeout: 180000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should create tasks from both files
			const listResult = await helpers.taskMaster('list', [], { cwd: testDir });
			if (!listResult.stdout.includes('responsive UI') || 
			    !listResult.stdout.includes('REST API')) {
				throw new Error('Not all PRD files were parsed');
			}
		});

		// Test 14: PRD with code blocks
		await runTest('PRD with code examples', async () => {
			const codePrd = `# Technical Implementation PRD

## Authentication Module

Implement JWT-based authentication with the following structure:

\`\`\`javascript
// Expected token payload
{
  userId: string,
  email: string,
  roles: string[],
  exp: number
}
\`\`\`

### Tasks:
1. Create token generation service
2. Implement token validation middleware
3. Add refresh token mechanism

## Database Schema

\`\`\`sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
\`\`\`

### Tasks:
1. Create database migrations
2. Add indexes for performance
3. Implement data validation`;

			helpers.writeFile(`${testDir}/code-prd.md`, codePrd);
			
			const result = await helpers.taskMaster(
				'parse-prd',
				['code-prd.md'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should parse tasks despite code blocks
			const listResult = await helpers.taskMaster('list', [], { cwd: testDir });
			if (!listResult.stdout.includes('token generation') || 
			    !listResult.stdout.includes('database migrations')) {
				throw new Error('Code blocks interfered with task parsing');
			}
		});

		// Test 15: PRD parsing with auto-grouping
		await runTest('PRD auto-grouping into epics', async () => {
			const epicPrd = `# E-Learning Platform

## User Management Epic
- User registration and profiles
- Role-based access control  
- Social login integration
- Password reset functionality

## Course Management Epic
- Course creation tools
- Video upload and processing
- Quiz and assignment builder
- Progress tracking

## Payment Processing Epic
- Subscription management
- Payment gateway integration
- Invoice generation
- Refund processing

## Analytics Epic
- User engagement metrics
- Course completion rates
- Revenue analytics
- Custom reports`;

			helpers.writeFile(`${testDir}/epic-prd.txt`, epicPrd);
			
			const result = await helpers.taskMaster(
				'parse-prd',
				['epic-prd.txt', '--group-by-section'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should create grouped tasks
			const listResult = await helpers.taskMaster('list', [], { cwd: testDir });
			
			// Check for epic grouping (tasks might have similar IDs or tags)
			if (!listResult.stdout.includes('User Management') || 
			    !listResult.stdout.includes('Course Management')) {
				throw new Error('Epic grouping not reflected in tasks');
			}
		});

		// Calculate summary
		const totalTests = results.tests.length;
		const passedTests = results.tests.filter(t => t.status === 'passed').length;
		const failedTests = results.tests.filter(t => t.status === 'failed').length;

		logger.info('\n=== Parse-PRD Test Summary ===');
		logger.info(`Total tests: ${totalTests}`);
		logger.info(`Passed: ${passedTests}`);
		logger.info(`Failed: ${failedTests}`);

		if (failedTests > 0) {
			results.status = 'failed';
			logger.error(`\n${failedTests} tests failed`);
		} else {
			logger.success('\n✅ All parse-prd tests passed!');
		}

	} catch (error) {
		results.status = 'failed';
		results.errors.push({
			test: 'parse-prd test suite',
			error: error.message,
			stack: error.stack
		});
		logger.error(`Parse-prd test suite failed: ${error.message}`);
	}

	return results;
}