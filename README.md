# Starfe



## Run these commands (After cloning repo).
```bash
npm init -y

npm install express

npm install sqlite3

npm install multer

npm install dotenv
```

**Note:** Copy `.env.example` to `.env` and adjust settings if needed:
```bash
cp .env.example .env
```

# Problem 
- Our campus use "Dine on Campus" to tell people all the available food options.
    - It has no way to receive feedback or for the consumers to review an offering.
- **Your Challenge:**
    - Build a system that allows the univeristy community members to post:
      - pictures
      - reviews of the food 
    - System should also list all the available items for that time of the day to be reviewed
- People should:
    - be able to upvote and downvote the food
    - have some way to associate pictures with any given item
- If any dietary restriction data is avaiable via any API, please show it

## Preparation 
- Began using the the white board to figure out the overall design of the whole project
- Find where the OCU dine on campus API was located and take their data
- Wrote out most the basic structure of the whole app on a couple of whiteboards
- After getting the basic structure of the app, we began engineering prompts for the AI to generate most of the app

## Influences 
- Tinder swipe for upvote, downvote, and skip 
- Basic comment boxes found in apps, such as Reddit and other platforms that allow commentary on posts 

## AI use
- ChatGPT
  - Used to generate all the frontend code and most of backend and database
  - Most functions to write to the database was written by AI
  - Scripts to create the tables were created by AI, but the initial ideas were not created by AI
    - Created by the whole group
- Gemini, Copilot, Open WebUI
  - Also used initially to create majority of the stack, but was discontinued in a different GitHub Repo
  - Open WebUI is an AI provided by Professor Tashfeen
 

## Initial Ideas
- Tinder swiping for upvote and downvote 
  - Database takes in whether or not the user hasn't tried it, liked it, or didn't like the food into the database
  - Whenever user swipes up, it tells the database that they haven't tried it
  - Whenever user clicks on something like: "Add a comment",
      - place for them to add comments, images, an react to other's reviews
  - Pie chart to show the statistic of the amount of upvotes, downvotes, and "did not try"s were chosen for each food item 
    - located on top of the comment section
- AI chatbot that reads the stats and provides answer after the user prompts it
  - Example: "What is the best food combo for today?"
  - Gambling aspect using OCU coin
    - Is the usual good food a hit or a miss?

## Issues we came across 
- Trying to write to a database 
    - Initially, we thought that we could write to a database using MySQL Workbench
    - Issue: we got a lot of errors linking up the connecting js file to the database
    - Solution: One of us already AI-generated another db file that had everything that we needed earlier and restarting the project from scratch
-  Finding an API that gives images for all the food items
    - Initially put images for the wrong food item (image of pizza --> egg) 
    - Reason: Cafe doesn't provide images of what they're offering to consumers
    - Solution: create an image upload for users to change the food image
-  Creating a filter function 
    - Initial idea: hamburger button that opens up a checkbox of common food allergens that filters out all the foods that the user checks 
    - CSS stopped showing up at one point
    - Button and the overall function didn't work
    - Solution: Asked ChatGPT 5.1 to solve the issue 
        - instead of a checkbox, created a list of things to click to filter out/
          - kept the original idea 

## Features Implemented
- Creating a menu page that displays location, food items, food stats, food images, meal type, date, nutrition, review this meal 
- Review this meal: allows user to review each food item for that day and meal type
    - stores rating into database and adds on to food stats in the menu page
    - Tinder influence
- Filter: list tags to exclude from the menu display
- Divided the 1300-line server.js file into separate JavaScript files

## Recent Improvements (December 2024)
- Added environment variable support with `.env` configuration
- Implemented error handling middleware for better error management
- Enhanced `.gitignore` to properly exclude dependencies, database files, and logs
- Fixed typos and improved documentation

## Future Improvements Planned
- Comment section
- AI chatbot

## Learning Outcomes
- Learned the consequences and benefits of coding with AI
- Applied the concept of frontend, backend, and database
- Learned how to prompt engineer
