# Unspoken 

## Flow
1. Menu - Start Game 
2. Setup Question
  1. Load JSON
  2. Setup Question
    1. Update question text 
    2. Update question 3D model
    3. Set current lookup pose
    4. Await user answer
      1. listen to user pose
        1. start from 0, set a threshold of 3 second
        2. if correct frame, add the deltaTime, otherwise, decrease the correct threshold in deltaTime by a factor
        3. Once threshold is met, consider answer is received
    5. Answer received, go to the next question, back to step 2
3. Display user result

## TODO
Refactoring
* 

Game Design:
* 

Game Feel:
* Add animation/transition when new question pop up
* When user get the correct answer
  * add some kind of audio feedback
  * scale up (bounce?) text and change color 

Question 
* Init - load up the quesiton
* Next - 
* 