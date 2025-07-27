#!/usr/bin/env node

/**
 * RBAC Verification Script
 * 
 * This script performs automated verification of Role-Based Access Control
 * implementation in the Kurniasari Admin Dashboard frontend.
 */

import fs from 'fs';
import path from 'path';

const COLORS = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m'
};

console.log(`${COLORS.BOLD}${COLORS.BLUE}🔒 RBAC Verification Script${COLORS.RESET}\n`);

class RBACVerifier {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      total: 0
    };
    this.issues = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      success: COLORS.GREEN,
      error: COLORS.RED,
      warning: COLORS.YELLOW,
      info: COLORS.BLUE
    };
    
    console.log(`${colors[type] || ''}[${timestamp}] ${message}${COLORS.RESET}`);
  }

  test(description, testFn) {
    this.results.total++;
    this.log(`Testing: ${description}`, 'info');
    
    try {
      const result = testFn();
      if (result === true) {
        this.results.passed++;
        this.log(`✅ PASS: ${description}`, 'success');
      } else if (result === 'warning') {
        this.results.warnings++;
        this.log(`⚠️  WARNING: ${description}`, 'warning');
      } else {
        this.results.failed++;
        this.log(`❌ FAIL: ${description}`, 'error');
        this.issues.push(description);
      }
    } catch (error) {
      this.results.failed++;
      this.log(`❌ FAIL: ${description} - ${error.message}`, 'error');
      this.issues.push(`${description}: ${error.message}`);
    }
  }

  verifyFileExists(filePath, description) {
    this.test(`File exists: ${description}`, () => {
      return fs.existsSync(filePath);
    });
  }

  verifyRouteProtection(appJsPath) {
    this.test('All admin routes use RoleProtectedRoute', () => {
      const content = fs.readFileSync(appJsPath, 'utf8');
      
      // Check that no admin routes use ProtectedRoute
      const adminRouteMatches = content.match(/path="\/admin[^"]*"[\s\S]*?<ProtectedRoute>/g);
      if (adminRouteMatches && adminRouteMatches.length > 0) {
        throw new Error(`Found ${adminRouteMatches.length} admin routes using ProtectedRoute instead of RoleProtectedRoute`);
      }
      
      return true;
    });

    this.test('All debug routes restricted to admin', () => {
      const content = fs.readFileSync(appJsPath, 'utf8');
      
      // Check that debug routes use RoleProtectedRoute with admin role
      const debugRoutes = content.match(/path="\/debug[^"]*"[\s\S]*?RoleProtectedRoute[^>]*allowedRoles={\['admin'\]}/g);
      const debugProtectedRoutes = content.match(/path="\/debug[^"]*"[\s\S]*?<ProtectedRoute>/g);
      
      if (debugProtectedRoutes && debugProtectedRoutes.length > 0) {
        throw new Error('Found debug routes using ProtectedRoute instead of admin-only RoleProtectedRoute');
      }
      
      return debugRoutes && debugRoutes.length > 0;
    });

    this.test('Products route has proper role restrictions', () => {
      const content = fs.readFileSync(appJsPath, 'utf8');
      
      // Check that products route allows admin and outlet_manager
      const productsRoute = content.match(/path="\/products"[\s\S]*?allowedRoles={\['admin',\s*'outlet_manager'\]}/);
      if (!productsRoute) {
        throw new Error('Products route should allow admin and outlet_manager roles');
      }
      
      return true;
    });

    this.test('New order route has proper role restrictions', () => {
      const content = fs.readFileSync(appJsPath, 'utf8');
      
      // Check that new order route allows admin and outlet_manager
      const newOrderRoute = content.match(/path="\/orders\/new"[\s\S]*?allowedRoles={\['admin',\s*'outlet_manager'\]}/);
      if (!newOrderRoute) {
        throw new Error('New order route should allow admin and outlet_manager roles');
      }
      
      return true;
    });

    this.test('Delivery routes restricted to deliveryman', () => {
      const content = fs.readFileSync(appJsPath, 'utf8');
      
      // Check that delivery routes use deliveryman role
      const deliveryRoutes = content.match(/path="\/delivery[^"]*"[\s\S]*?allowedRoles={\['deliveryman'\]}/g);
      if (!deliveryRoutes || deliveryRoutes.length < 2) {
        throw new Error('Delivery routes should be restricted to deliveryman role');
      }
      
      return true;
    });

    this.test('Outlet routes restricted to outlet_manager', () => {
      const content = fs.readFileSync(appJsPath, 'utf8');
      
      // Check that outlet routes use outlet_manager role
      const outletRoutes = content.match(/path="\/outlet[^"]*"[\s\S]*?allowedRoles={\['outlet_manager'\]}/g);
      if (!outletRoutes || outletRoutes.length < 3) {
        throw new Error('Outlet routes should be restricted to outlet_manager role');
      }
      
      return true;
    });
  }

  verifyAuthContext(authContextPath) {
    this.test('AuthContext has role checking functions', () => {
      const content = fs.readFileSync(authContextPath, 'utf8');
      
      const hasRoleFunction = content.includes('hasRole');
      const belongsToOutletFunction = content.includes('belongsToOutlet');
      const getDashboardRouteFunction = content.includes('getDashboardRoute');
      
      if (!hasRoleFunction || !belongsToOutletFunction || !getDashboardRouteFunction) {
        throw new Error('AuthContext missing required role checking functions');
      }
      
      return true;
    });

    this.test('AuthContext properly handles role-based redirects', () => {
      const content = fs.readFileSync(authContextPath, 'utf8');
      
      // Check that getDashboardRoute handles all roles
      const adminRedirect = content.includes("case 'admin':");
      const outletRedirect = content.includes("case 'outlet_manager':");
      const deliveryRedirect = content.includes("case 'deliveryman':");
      
      if (!adminRedirect || !outletRedirect || !deliveryRedirect) {
        throw new Error('AuthContext getDashboardRoute missing role cases');
      }
      
      return true;
    });
  }

  verifyRoleProtectedRoute(roleProtectedRoutePath) {
    this.test('RoleProtectedRoute properly enforces roles', () => {
      const content = fs.readFileSync(roleProtectedRoutePath, 'utf8');
      
      // Check that it validates roles
      const roleValidation = content.includes('allowedRoles.includes(user.role)');
      const redirectsUnauthorized = content.includes('Navigate to=');
      
      if (!roleValidation || !redirectsUnauthorized) {
        throw new Error('RoleProtectedRoute not properly enforcing role restrictions');
      }
      
      return true;
    });

    this.test('RoleProtectedRoute has proper role-based redirect logic', () => {
      const content = fs.readFileSync(roleProtectedRoutePath, 'utf8');
      
      // Check for proper redirect logic for each role
      const adminRedirect = content.includes("case 'admin':");
      const outletRedirect = content.includes("case 'outlet_manager':");
      const deliveryRedirect = content.includes("case 'deliveryman':");
      
      if (!adminRedirect || !outletRedirect || !deliveryRedirect) {
        throw new Error('RoleProtectedRoute missing proper redirect logic for all roles');
      }
      
      return true;
    });
  }

  verifyPublicRoutes(appJsPath) {
    this.test('Public routes are not protected', () => {
      const content = fs.readFileSync(appJsPath, 'utf8');
      
      // Check that public order routes don't use protection
      const publicOrderRoutes = content.match(/path="\/orders\/:id"[\s\S]*?<PublicLayout>/);
      const publicOrderSingular = content.match(/path="\/order\/:id"[\s\S]*?<PublicLayout>/);
      
      if (!publicOrderRoutes || !publicOrderSingular) {
        throw new Error('Public order routes should use PublicLayout without authentication');
      }
      
      return true;
    });
  }

  generateReport() {
    console.log(`\n${COLORS.BOLD}${COLORS.BLUE}📊 RBAC Verification Report${COLORS.RESET}\n`);
    
    const passRate = (this.results.passed / this.results.total * 100).toFixed(1);
    
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`${COLORS.GREEN}Passed: ${this.results.passed}${COLORS.RESET}`);
    console.log(`${COLORS.RED}Failed: ${this.results.failed}${COLORS.RESET}`);
    console.log(`${COLORS.YELLOW}Warnings: ${this.results.warnings}${COLORS.RESET}`);
    console.log(`Pass Rate: ${passRate}%\n`);

    if (this.results.failed > 0) {
      console.log(`${COLORS.RED}${COLORS.BOLD}❌ CRITICAL ISSUES FOUND:${COLORS.RESET}`);
      this.issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
      console.log('');
    }

    if (this.results.failed === 0 && this.results.warnings === 0) {
      console.log(`${COLORS.GREEN}${COLORS.BOLD}✅ ALL RBAC TESTS PASSED - READY FOR PRODUCTION${COLORS.RESET}\n`);
      return true;
    } else if (this.results.failed === 0) {
      console.log(`${COLORS.YELLOW}${COLORS.BOLD}⚠️  RBAC TESTS PASSED WITH WARNINGS${COLORS.RESET}\n`);
      return true;
    } else {
      console.log(`${COLORS.RED}${COLORS.BOLD}❌ RBAC TESTS FAILED - SECURITY VULNERABILITIES DETECTED${COLORS.RESET}\n`);
      return false;
    }
  }

  async run() {
    const basePath = process.cwd();
    
    console.log(`Verifying RBAC implementation in: ${basePath}\n`);

    // File paths
    const appJsPath = path.join(basePath, 'src', 'App.jsx');
    const authContextPath = path.join(basePath, 'src', 'auth', 'AuthContext.jsx');
    const roleProtectedRoutePath = path.join(basePath, 'src', 'auth', 'RoleProtectedRoute.jsx');
    const protectedRoutePath = path.join(basePath, 'src', 'auth', 'ProtectedRoute.jsx');

    // Verify core files exist
    this.verifyFileExists(appJsPath, 'Main App.jsx');
    this.verifyFileExists(authContextPath, 'AuthContext.jsx');
    this.verifyFileExists(roleProtectedRoutePath, 'RoleProtectedRoute.jsx');
    this.verifyFileExists(protectedRoutePath, 'ProtectedRoute.jsx');

    // Verify RBAC implementation
    if (fs.existsSync(appJsPath)) {
      this.verifyRouteProtection(appJsPath);
      this.verifyPublicRoutes(appJsPath);
    }

    if (fs.existsSync(authContextPath)) {
      this.verifyAuthContext(authContextPath);
    }

    if (fs.existsSync(roleProtectedRoutePath)) {
      this.verifyRoleProtectedRoute(roleProtectedRoutePath);
    }

    // Generate final report
    const success = this.generateReport();
    
    // Exit with appropriate code
    process.exit(success ? 0 : 1);
  }
}

// Run the verification
const verifier = new RBACVerifier();
verifier.run().catch(error => {
  console.error(`${COLORS.RED}Verification failed: ${error.message}${COLORS.RESET}`);
  process.exit(1);
});
