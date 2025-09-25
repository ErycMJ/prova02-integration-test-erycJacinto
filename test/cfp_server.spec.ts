import pactum from 'pactum';

const BASE_URL = process.env.CFP_BASE_URL || 'https://cfp-server.vercel.app';

describe('CFP Server - e2e tests', () => {
  const timestamp = Date.now();
  const user = {
    username: `test_user_${timestamp}`,
    email: `test_${timestamp}@example.com`,
    password: 'Test@12345',
    mobile: '999999999'
  };

  let cookie: string;
  let categoryId: string;
  let transactionId: string;
  let goalId: string;

  beforeAll(async () => {
    pactum.request.setBaseUrl(BASE_URL);
    pactum.request.setDefaultTimeout(20000);

    // Try to signup first
    try {
      console.log('Attempting signup for:', user.email);
      await pactum
        .spec()
        .post('/user/signup')
        .withJson(user)
        .expectStatus(200);
      console.log('Signup successful');
    } catch (error) {
      console.log('Signup failed, user might exist');
    }

    // Always try signin
    try {
      console.log('Attempting signin for:', user.email);
      const response = await pactum
        .spec()
        .post('/user/signin')
        .withJson({
          email: user.email,
          password: user.password
        })
        .expectStatus(200);

      // Extract cookie properly
      const setCookieHeader = response.headers['set-cookie'];
      if (setCookieHeader) {
        cookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
        console.log('Cookie extracted successfully');
      } else {
        throw new Error('No cookie received from signin');
      }
    } catch (signinError) {
      // If signin fails, try with a completely new user
      console.log('Signin failed, creating new user');
      const newTimestamp = Date.now() + Math.floor(Math.random() * 1000);
      const newUser = {
        username: `test_user_${newTimestamp}`,
        email: `test_${newTimestamp}@example.com`,
        password: 'Test@12345',
        mobile: '999999999'
      };

      // Force signup new user
      await pactum
        .spec()
        .post('/user/signup')
        .withJson(newUser)
        .expectStatus(200);

      // Signin with new user
      const response = await pactum
        .spec()
        .post('/user/signin')
        .withJson({
          email: newUser.email,
          password: newUser.password
        })
        .expectStatus(200);

      const setCookieHeader = response.headers['set-cookie'];
      cookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
      
      // Update user reference for cleanup
      Object.assign(user, newUser);
    }
    
    expect(cookie).toBeDefined();
  });

  afterAll(async () => {
    if (cookie) {
      try {
        await pactum
          .spec()
          .get('/user/signout')
          .withHeaders('Cookie', cookie)
          .expectStatus(201);
      } catch (error) {
        console.log('Signout failed, but continuing');
      }
    }
  });

  describe('User Authentication', () => {
    it('should access protected route successfully', async () => {
      await pactum
        .spec()
        .get('/user/protectedRoute')
        .withHeaders('Cookie', cookie)
        .expectStatus(200)
        .expectJsonLike({
          success: true
        });
    });
  });

  describe('Category Management', () => {
    it('should create a new category', async () => {
      const response = await pactum
        .spec()
        .post('/category/addCategory')
        .withHeaders('Cookie', cookie)
        .withJson({
          categoryName: `Test Category ${Date.now()}`,
          categoryType: 'expense'
        })
        .expectStatus(200)
        .expectJsonLike({
          success: true
        });
      
      categoryId = response.json.category._id;
      expect(categoryId).toBeDefined();
    });

    it('should list all categories', async () => {
      await pactum
        .spec()
        .get('/category/getCategory')
        .withHeaders('Cookie', cookie)
        .expectStatus(200)
        .expectJsonLike({
          success: true
        });
    });

    it('should delete the created category', async () => {
      await pactum
        .spec()
        .delete(`/category/deleteCategory/${categoryId}`)
        .withHeaders('Cookie', cookie)
        .expectStatus(200)
        .expectJsonLike({
          success: true
        });
    });
  });

  describe('Transaction Management', () => {
    beforeAll(async () => {
      // Create a category for transactions
      const categoryResponse = await pactum
        .spec()
        .post('/category/addCategory')
        .withHeaders('Cookie', cookie)
        .withJson({
          categoryName: `Transaction Category ${Date.now()}`,
          categoryType: 'expense'
        })
        .expectStatus(200);
      
      categoryId = categoryResponse.json.category._id;
    });

    it('should create a new transaction', async () => {
      const response = await pactum
        .spec()
        .post('/transaction/addTransaction')
        .withHeaders('Cookie', cookie)
        .withForm({
          type: 'expense',
          category: categoryId,
          date: new Date().toISOString(),
          note: 'Test transaction',
          amount: '100.50',
          currency: 'BRL'
        })
        .expectStatus(200)
        .expectJsonLike({
          success: true
        });
      
      transactionId = response.json.transaction._id;
      expect(transactionId).toBeDefined();
    });

    it('should list all transactions', async () => {
      await pactum
        .spec()
        .get('/transaction/getTransaction')
        .withHeaders('Cookie', cookie)
        .expectStatus(200)
        .expectJsonLike({
          success: true
        });
    });

    it('should update the transaction', async () => {
      await pactum
        .spec()
        .put(`/transaction/editTransaction/${transactionId}`)
        .withHeaders('Cookie', cookie)
        .withForm({
          note: 'Updated test transaction',
          amount: '150.75'
        })
        .expectStatus(200)
        .expectJsonLike({
          success: true
        });
    });

    it('should delete the transaction', async () => {
      await pactum
        .spec()
        .delete(`/transaction/deleteTransaction/${transactionId}`)
        .withHeaders('Cookie', cookie)
        .expectStatus(200)
        .expectJsonLike({
          success: true
        });
    });
  });

  describe('Goals and Limits Management', () => {
    it('should create a new goal/limit', async () => {
      const response = await pactum
        .spec()
        .post('/meta/goals-limits')
        .withHeaders('Cookie', cookie)
        .withJson({
          goal: 1000,
          limit: 500
        })
        .expectStatus(200)
        .expectJsonLike({
          success: true
        });
      
      goalId = response.json.goalLimit._id;
      expect(goalId).toBeDefined();
    });

    it('should list all goals/limits', async () => {
      await pactum
        .spec()
        .get('/meta/goals-limits')
        .withHeaders('Cookie', cookie)
        .expectStatus(200)
        .expectJsonLike({
          success: true
        });
    });

    it('should update the goal/limit', async () => {
      await pactum
        .spec()
        .put(`/meta/goals-limits/${goalId}`)
        .withHeaders('Cookie', cookie)
        .withJson({
          goal: 2000,
          limit: 800
        })
        .expectStatus(200)
        .expectJsonLike({
          success: true
        });
    });
  });
});
