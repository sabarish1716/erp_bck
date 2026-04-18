/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SIBLING SCHOOL SELECTION: OTHER SCHOOL IMPLEMENTATION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This document describes the backend implementation for handling dynamic
 * "Other School" input in the student admission system for siblings.
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * DATABASE SCHEMA CHANGES
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Added two new nullable string fields to the Family model:
 * 
 * model Family {
 *   ...
 *   sibling1OtherSchoolName   String?   // Custom school name if "Other School" selected
 *   sibling2OtherSchoolName   String?   // Custom school name if "Other School" selected
 *   ...
 * }
 * 
 * Migration: 20260416_add_sibling_other_school_names
 *   - Adds sibling1OtherSchoolName column to Family table
 *   - Adds sibling2OtherSchoolName column to Family table
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * BUSINESS LOGIC
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * The processSiblingSchoolSelection() function implements the following logic:
 * 
 * 1. IF school selection is "Other School":
 *    - REQUIRE custom school name to be provided and non-empty
 *    - STORE custom school name in sibling{N}OtherSchoolName
 *    - STORE "Other School" in sibling{N}School field
 *    - THROW BadRequestException if custom name is missing
 * 
 * 2. IF school selection is anything else (e.g., "Same School" or predefined):
 *    - STORE the selected school name in sibling{N}School
 *    - CLEAR sibling{N}OtherSchoolName (set to null)
 *    - NO validation needed (field is optional)
 * 
 * 3. IF no school is selected:
 *    - STORE both fields as null
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * DATA FLOW
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Frontend → Backend → Database
 * 
 * Frontend sends:
 * {
 *   family: {
 *     sibling1School: "Other School",
 *     sibling1OtherSchoolName: "St. Xavier's School",
 *     sibling2School: "Same School",
 *     sibling2OtherSchoolName: undefined  // Not sent
 *   }
 * }
 * 
 * Backend processes:
 * - Sibling 1: processSiblingSchoolSelection("1", "Other School", "St. Xavier's School")
 *   → Returns: { processedSchool: "Other School", processedCustomSchoolName: "St. Xavier's School" }
 * 
 * - Sibling 2: processSiblingSchoolSelection("2", "Same School", undefined)
 *   → Returns: { processedSchool: "Same School", processedCustomSchoolName: null }
 * 
 * Database stores:
 * {
 *   sibling1School: "Other School",
 *   sibling1OtherSchoolName: "St. Xavier's School",
 *   sibling2School: "Same School",
 *   sibling2OtherSchoolName: null
 * }
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * API ENDPOINT CHANGES
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * POST /admissions (Create)
 * POST /admissions/:id (Update)
 * 
 * Request Body (CreateAdmissionDto):
 * {
 *   family: {
 *     sibling1Name?: string;
 *     sibling1Standard?: string;
 *     sibling1School?: string;              // "Same School", "Other School", or predefined
 *     sibling1OtherSchoolName?: string;    // Required only if sibling1School === "Other School"
 *     
 *     sibling2Name?: string;
 *     sibling2Standard?: string;
 *     sibling2School?: string;              // "Same School", "Other School", or predefined
 *     sibling2OtherSchoolName?: string;    // Required only if sibling2School === "Other School"
 *   }
 * }
 * 
 * Error Response (if validation fails):
 * Status: 400 Bad Request
 * Body: {
 *   statusCode: 400,
 *   message: "Sibling 1: \"Other School\" selected but school name not provided. Please enter the school name.",
 *   error: "Bad Request"
 * }
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * VALIDATION RULES
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * ✓ VALID: User selects "Other School" and provides school name
 *   sibling1School: "Other School"
 *   sibling1OtherSchoolName: "St. Mary's Convent"
 * 
 * ✓ VALID: User selects predefined school
 *   sibling1School: "Same School"
 * 
 * ✓ VALID: User doesn't fill sibling information
 *   sibling1School: null
 * 
 * ✗ INVALID: User selects "Other School" without providing school name
 *   sibling1School: "Other School"
 *   sibling1OtherSchoolName: null or ""
 *   → Throws: "Sibling 1: \"Other School\" selected but school name not provided..."
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * IMPLEMENTATION DETAILS
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * File: src/admission/admission.service.ts
 * 
 * Function: processSiblingSchoolSelection(siblingNumber, schoolValue, customSchoolName)
 * - Validates and processes sibling school selection
 * - Returns processed values for database storage
 * - Throws BadRequestException if validation fails
 * 
 * Locations where validation is applied:
 * 1. createAdmission() - Line ~280-310 (Sibling 1 & 2)
 * 2. updateStudent() - Line ~680-710 (Sibling 1 & 2 in update)
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * BACKWARD COMPATIBILITY
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Existing records (created before this change):
 * - sibling{N}OtherSchoolName will be NULL
 * - sibling{N}School will contain the school value as before
 * - No migration of data is needed
 * - Old code pattern still works: sibling1School contains "Other school name"
 * 
 * To migrate old data to new schema (optional):
 * 
 * -- Check if sibling school starts with custom school pattern
 * SELECT * FROM "Family" 
 * WHERE sibling1School NOT IN ('Same School', 'Other School')
 * AND sibling1School IS NOT NULL;
 * 
 * -- Update old records to use new pattern:
 * UPDATE "Family"
 * SET sibling1OtherSchoolName = sibling1School,
 *     sibling1School = 'Other School'
 * WHERE sibling1School NOT IN ('Same School', 'Other School')
 * AND sibling1School IS NOT NULL;
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * TESTING
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Test Case 1: Create admission with both siblings selecting "Other School"
 * 
 * Request:
 * POST /admissions
 * {
 *   name: "John Doe",
 *   family: {
 *     sibling1Name: "Jane Doe",
 *     sibling1Standard: "5",
 *     sibling1School: "Other School",
 *     sibling1OtherSchoolName: "Holy Cross School",
 *     sibling2Name: "Jack Doe",
 *     sibling2Standard: "3",
 *     sibling2School: "Other School",
 *     sibling2OtherSchoolName: "St. George School"
 *   }
 * }
 * 
 * Expected Result: Success
 * Database stores both custom school names
 * 
 * ---
 * 
 * Test Case 2: Create admission with "Other School" but no custom name
 * 
 * Request:
 * POST /admissions
 * {
 *   name: "John Doe",
 *   family: {
 *     sibling1Name: "Jane Doe",
 *     sibling1School: "Other School"
 *     // sibling1OtherSchoolName not provided
 *   }
 * }
 * 
 * Expected Result: 400 Bad Request
 * Error: "Sibling 1: \"Other School\" selected but school name not provided..."
 * 
 * ---
 * 
 * Test Case 3: Update admission, changing from "Other School" to "Same School"
 * 
 * Request:
 * PATCH /admissions/:id
 * {
 *   family: {
 *     sibling1School: "Same School"
 *     // Changing from "Other School" to "Same School"
 *   }
 * }
 * 
 * Expected Result: Success
 * Database updates:
 * - sibling1School = "Same School"
 * - sibling1OtherSchoolName = NULL (cleared)
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * DEPLOYMENT INSTRUCTIONS
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * 1. Pull latest code
 * 2. Run: npx prisma migrate deploy
 *    This applies the migration: 20260416_add_sibling_other_school_names
 * 3. Restart backend service
 * 4. No frontend changes required (already implemented)
 * 5. Test with sample admissions
 * 
 * ───────────────────────────────────────────────────────────────────────────
 */
