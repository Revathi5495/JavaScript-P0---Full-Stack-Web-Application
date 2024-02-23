const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const port = 3001;

app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true }))


// Configure session middleware
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));


const pool = new Pool({
  user: 'postgres',
  host: '34.75.228.71',
  database: 'revathi',
  password: 'password',
  port: '5432' // default is 5432
})

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


app.use(express.static('public'));
//app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('sign');
});

// New route for registration
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const client = await pool.connect();
    const result = await client.query('INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *', [username, email, password]);
    res.status(201).json({ message: 'User registered successfully' });
    client.release();
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// New route for signing in

app.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  try {
      const client = await pool.connect();
      const result = await client.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
      if (result.rows.length > 0) {
          // Successful sign-in, redirect to /index
          req.session.email = email;
          res.json({ success: true });
          console.log("Sign in successful!!");
      } else {
          // Invalid credentials, send error message as JSON response
          res.status(401).json({ success: false, message: 'Invalid email or password' });
          console.log("Invalid email or password");
      }
      client.release();
  } catch (err) {
      console.error('Error signing in:', err);
      res.status(500).send('Internal server error');
  }
});


// Helper function to generate UUIDs
// function generateUUID() {
//   return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
//     var r = Math.random() * 16 | 0,
//         v = c == 'x' ? r : (r & 0x3 | 0x8);
//     return v.toString(16);
//   });
// }

// app.get('/index', async (req, res) => {
//   try {
//     // Check if user has a cart ID stored in session
//     let cartId = req.session.cartId;
//     if (!cartId) {
//       // If not, generate a new cart ID
//       cartId = generateUUID();
//       req.session.cartId = cartId;
//     }

//     // Check if user has an order ID stored in session
//     let orderId = req.session.orderId;
//     if (!orderId) {
//       // If not, generate a new order ID
//       orderId = generateUUID();
//       req.session.orderId = orderId;
//     }

//     const client = await pool.connect();
//     const result = await client.query('SELECT * FROM r_movie');
//     const movies = result.rows;
//     client.release();
//     res.render('index', { movies, cartId, orderId }); // Pass cartId and orderId to index.ejs
//   } catch (err) {
//     console.error('Error fetching movie details:', err);
//     res.status(500).send('Internal Server Error');
//   }
// });


app.get('/index', async (req, res) => {
  try {
      const client = await pool.connect();
      const result = await client.query('SELECT * FROM r_movie');
      const movies = result.rows;

      client.release();
      res.render('index', { movies }); // Pass movies to index.ejs
  } catch (err) {
      console.error('Error fetching movie details:', err);
      res.status(500).send('Internal Server Error');
  }
});

app.post('/addToCart', async (req, res) => {
  const {title, rating, image_url } = req.body;

  // Retrieve user's email from the session
  const userEmail = req.session.email;

  // Check if user is authenticated
  if (!userEmail) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
  }

  try {
      // Insert into cart table with user's email
      const query = 'INSERT INTO cart (email, title, rating, image_url) VALUES ($1, $2, $3, $4)';
      const values = [userEmail, title, rating, image_url];

      const client = await pool.connect();
      const result = await client.query(query, values);

      client.release();
      
      console.log('Item added to cart successfully');
      res.status(200).send('Item added to cart successfully');
  } catch (err) {
      console.error('Error adding to cart:', err);
      res.status(500).send('Error adding to cart');
  }
});

app.get('/cartItems', (req, res) => {
  const Useremail = req.session.email; // Retrieve cartId from session
  const query = 'SELECT * FROM cart WHERE email = $1';
  const values = [Useremail];

  pool.query(query, values, (err, result) => {
      if (err) {
          console.error('Error fetching cart items:', err);
          res.status(500).send('Error fetching cart items');
      } else {
          const cartItems = result.rows;
          res.render('cart', { cartItems: cartItems }); 
      }
  });
});

app.delete('/removeFromCart/:itemId', (req, res) => {
  const itemId = req.params.itemId; // Extract movie_id from request parameters
  // const Useremail = req.session.email; // Assuming you may need this later
  const query = 'DELETE FROM cart WHERE movie_id = $1';
  const values = [itemId]; // Use itemId to delete the corresponding movie from cart

  pool.query(query, values, (err, result) => {
      if (err) {
          console.error('Error removing item from cart:', err);
          res.status(500).send('Error removing item from cart');
      } else {
          console.log('Item removed from cart successfully');
          res.status(200).send('Item removed from cart successfully');
      }
  });
});

app.post('/placeOrder', async (req, res) => {
  try {
     // Retrieve cartId from session
    const Useremail = req.session.email;
    const client = await pool.connect();

    // Get cart items for the current user
    const cartItemsQuery = 'SELECT * FROM cart WHERE email= $1';
    const cartItemsValues = [Useremail];
    const cartItemsResult = await client.query(cartItemsQuery, cartItemsValues);
    const cartItems = cartItemsResult.rows;

    // Insert each cart item into the orders table with the associated order_id
    for (const cartItem of cartItems) {
      const { title, rating, image_url } = cartItem;
      const insertOrderQuery = 'INSERT INTO order_table (email, title, rating, image_url) VALUES ($1, $2, $3, $4)';
      const insertOrderValues = [Useremail, title, rating, image_url];
      await client.query(insertOrderQuery, insertOrderValues);
    }

    // Clear the cart after placing the order
    const clearCartQuery = 'DELETE FROM cart WHERE email= $1';
    const clearCartValues = [Useremail];
    await client.query(clearCartQuery, clearCartValues);

    client.release();
    console.log("rented successfully");
    res.redirect('/orders');
    //res.status(200).send('Order placed successfully');
  } catch (err) {
    console.error('Error placing order:', err);
    res.status(500).send('Error placing order');
  }
});

app.get('/orders', async (req, res) => {
  try {
    const Useremail = req.session.email; // Retrieve orderId from session
    const query = 'SELECT title, rating, image_url FROM order_table WHERE email = $1';
    const { rows } = await pool.query(query, [Useremail]);

    res.render('orders', { orders: rows });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).send('Error fetching orders');
  }
});


app.delete('/clearOrders', (req, res) => {
  const Useremail = req.session.email; // Retrieve orderId from session
  const query = 'DELETE FROM order_table WHERE email = $1';

  pool.query(query, [Useremail], (err, result) => {
    if (err) {
      console.error('Error clearing orders:', err);
      res.status(500).send('Error clearing orders');
    } else {
      console.log('Orders cleared successfully');
      res.status(204).send('Orders cleared successfully');
    }
  });
});


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
