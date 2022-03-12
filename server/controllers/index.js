// pull in our models. This will automatically load the index.js from that folder
const models = require('../models');

// get the Cat model
const { Cat } = models;

// default fake data so that we have something to work with until we make a real Cat
const defaultData = {
  name: 'unknown',
  bedsOwned: 0,
};

// object for us to keep track of the last Cat we made and dynamically update it sometimes
let lastAdded = new Cat(defaultData);

// Function to handle rendering the index page.
const hostIndex = (req, res) => {
  /* res.render will render the given view from the views folder. In this case, index.
     We pass it a number of variables to populate the page.
  */
  res.render('index', {
    currentName: lastAdded.name,
    title: 'Home',
    pageName: 'Home Page',
  });
};

// Function for rendering the page1 template
// Page1 has a loop that iterates over an array of cats
const hostPage1 = async (req, res) => {
  /* Remember that our database is an entirely separate server from our node
     code. That means all interactions with it are async, and just because our
     server is up doesn't mean our database is. Therefore, any time we
     interact with it, we need to account for scenarios where it is not working.
     That is why the code below is wrapped in a try/catch statement.
  */
  try {
    /* We want to find all the cats in the Cat database. To do this, we need
       to make a "query" or a search. Queries in Mongoose are "thenable" which
       means they work like promises. Since they work like promises, we can also
       use await/async with them.

       The result of any query will either throw an error, or return zero, one, or
       multiple "documents". Documents are what our database stores. It is often
       abbreviated to "doc" or "docs" (one or multiple).

       .find() is a function in all Mongoose models (like our Cat model). It takes
       in an object as a parameter that defines the search. In this case, we want
       to find every cat, so we give it an empty object because that will not filter
       out any cats.

       .lean() is a modifier for the find query. Instead of returning entire mongoose
       documents, .lean() will only return the JS Objects being stored. Try printing
       out docs with and without .lean() to see the difference.

       .exec() executes the chain of operations. It is not strictly necessary and
       can be removed. However, mongoose gives better error messages if we use it.
    */
    const docs = await Cat.find({}).lean().exec();

    // Once we get back the docs array, we can send it to page1.
    return res.render('page1', { cats: docs });
  } catch (err) {
    /* If our database returns an error, or is unresponsive, we will print that error to
       our console for us to see. We will also send back an error message to the client.

       We don't want to send back the err from mongoose, as that would be unsafe. You
       do not want people to see actual error messages from your server or database, or else
       they can exploit them to attack your server.
    */
    console.log(err);
    return res.status(500).json({ error: 'failed to find cats' });
  }
};

// Function to render the untemplated page2.
const hostPage2 = (req, res) => {
  res.render('page2');
};

// Function to render the untemplated page3.
const hostPage3 = (req, res) => {
  res.render('page3');
};

// Get name will return the name of the last added cat.
const getName = (req, res) => res.json({ name: lastAdded.name });

// Function to create a new cat in the database
const setName = async (req, res) => {
  /* If we look at views/page2.handlebars, the form has inputs for a firstname, lastname
     and a number of beds. When this POST request is sent to us, the bodyParser plugin
     we configured in app.js will store that information in req.body for us.
  */
  if (!req.body.firstname || !req.body.lastname || !req.body.beds) {
    // If they are missing data, send back an error.
    return res.status(400).json({ error: 'firstname, lastname and beds are all required' });
  }

  /* If they did send all the data, we want to create a cat and add it to our database.
     We begin by creating a cat that matches the format of our Cat schema. In this case,
     we define a name and bedsOwned. We don't need to define the createdDate, because the
     default Date.now function will populate that value for us later.
  */
  const catData = {
    name: `${req.body.firstname} ${req.body.lastname}`,
    bedsOwned: req.body.beds,
  };

  /* Once we have our cat object set up. We want to turn it into something the database
     can understand. To do this, we create a new instance of a Cat using the Cat model
     exported from the Models folder.

     Note that this does NOT store the cat in the database. That is the next step.
  */
  const newCat = new Cat(catData);

  /* We have now setup a cat in the right format. We now want to store it in the database.
     Again, because the database and node server are separate things entirely we have no
     way of being sure the database will work or respond. Because of that, we wrap our code
     in a try/catch.
  */
  try {
    /* newCat is a version of our catData that is database-friendly. If you print it, you will
       see it has extra information attached to it other than name and bedsOwned. One thing it
       now has is a .save() function. This function will intelligently add or update the cat in
       the database. Since we have never saved this cat before, .save() will create a new cat in
       the database. All calls to the database are async, including .save() so we will await the
       databases response. If something goes wrong, we will end up in our catch() statement.
    */
    await newCat.save();

    /* After our await has resolved, and if no errors have occured during the await, we will end
       up here. We will update our lastAdded cat to the one we just added. We will then send that
       cat's data to the client.
    */
    lastAdded = newCat;
    return res.json({
      name: lastAdded.name,
      beds: lastAdded.bedsOwned,
    });
  } catch (err) {
    // If something goes wrong while communicating with the database, log the error and send
    // an error message back to the client.
    console.log(err);
    return res.status(500).json({ error: 'failed to create cat' });
  }
};

// Function to handle searching a cat by name.
const searchName = async (req, res) => {
  /* When the user makes a POST request, bodyParser populates req.body with the parameters
     as we saw in setName() above. In the case of searchName, the user is making a GET request.
     GET requests do not have a body, but they can have query parameters. bodyParser will also
     handle these, and store them in req.query instead.

     If the user does not give us a name to search by, throw an error.
  */
  if (!req.query.name) {
    return res.status(400).json({ error: 'Name is required to perform a search' });
  }

  /* If they do give us a name to search, we will as the database for a cat with that name.
     Remember that since we are interacting with the database, we want to wrap our code in a
     try/catch in case the database throws an error or doesn't respond.
  */
  try {
    /* Just like Cat.find() in hostPage1() above, Mongoose models also have a .findOne()
       that will find a single document in the database that matches the search parameters.
       This function is faster, as it will stop searching after it finds one document that
       matches the parameters. The downside is you cannot get multiple responses with it.

       One of three things will occur when trying to findOne in the database.
        1) An error will be thrown, which will stop execution of the try block and move to the catch block.
        2) Everything works, but the name was not found in the database returning an empty doc object.
        3) Everything works, and an object matching the search is found.
    */
    const doc = await Cat.findOne({ name: req.query.name }).exec();

    // If we do not find something that matches our search, doc will be empty.
    if (!doc) {
      return res.json({ error: 'No cats found' });
    }

    // Otherwise, we got a result and will send it back to the user.
    return res.json({ name: doc.name, beds: doc.bedsOwned });
  } catch (err) {
    // If there is an error, log it and send the user an error message.
    console.log(err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

/* A function for updating the last cat added to the database.
   Usually database updates would be a more involved process, involving finding
   the right element in the database based on query, modifying it, and updating
   it. For this example we will just update the last one we added for simplicity.
*/
const updateLast = (req, res) => {
  // First we will update the number of bedsOwned.
  lastAdded.bedsOwned++;

  /* Remember that lastAdded is a Mongoose document (made on line 14 if no new
     ones were made after the server started, or line 116 if there was). Mongo
     documents have an _id, which is a globally unique identifier that distinguishes
     them from other documents. Our mongoose document also has this _id. When we
     call .save() on a document, Mongoose and Mongo will use the _id to determine if
     we are creating a new database entry (if the _id doesn't already exist), or
     if we are updating an existing entry (if the _id is already in the database).

     Since lastAdded is likely already in the database, .save() will update it rather
     than make a new cat.

     We can use async/await for this, or just use standard promise .then().catch() syntax.
  */
  const savePromise = lastAdded.save();

  // If we successfully save/update them in the database, send back the cat's info.
  savePromise.then(() => res.json({
    name: lastAdded.name,
    beds: lastAdded.bedsOwned,
  }));

  // If something goes wrong saving to the database, log the error and send a message to the client.
  savePromise.catch((err) => {
    console.log(err);
    return res.status(500).json({ error: 'Something went wrong' });
  });
};

// A function to send back the 404 page.
const notFound = (req, res) => {
  res.status(404).render('notFound', {
    page: req.url,
  });
};

// export the relevant public controller functions
module.exports = {
  index: hostIndex,
  page1: hostPage1,
  page2: hostPage2,
  page3: hostPage3,
  getName,
  setName,
  updateLast,
  searchName,
  notFound,
};
