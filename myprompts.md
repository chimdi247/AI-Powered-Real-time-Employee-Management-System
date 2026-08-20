<!-- Always include "read /knowledge.md" -->

1. read /knowledge.md and Let's begin by setting up our **Express** backend and configuring **Nodemon** for development. Express will power our REST API throughout this project, while Nodemon automatically restarts the server whenever we make changes, giving us a faster development workflow. We'll create our server entry point, configure the development scripts, and verify that our Express server is running successfully on port **5000** before we start building the Employee Management System.

2. read /knowledge.md and Now that our Express server is up and running, let's configure the essential middleware that every production-ready backend should have. We'll load environment variables with Dotenv, secure our API using Helmet, configure CORS to safely handle requests from our frontend, enable Cookie Parser for authentication, and add Express middleware to parse incoming JSON and form data. By the end of this step, our backend will be secure, well-configured, and ready to start building features.

3. read /knowledge.md and With our middleware in place, the next step is setting up request logging for development. We'll use Morgan to log every incoming request, including methods like **GET**, **POST**, **PUT**, **PATCH**, and **DELETE**, along with their response status and execution time. This makes it much easier to monitor API activity, debug issues, and verify that our endpoints are working correctly as we build the application.

4. read /knowledge.md and Now let's connect our Express backend to MongoDB using Mongoose. We'll create a dedicated database configuration, load the MongoDB connection string from our environment variables, and establish the connection when the server starts. Using Mongoose gives us schema-based models, validation, and a clean way to interact with our MongoDB database as we build the employee management features. - ENV already set up in .env file

5. read /knowledge.md and Let's start by setting up JWT authentication for our employee management system. We'll configure a secure JWT secret through environment variables and use JSON Web Tokens to maintain the user's authenticated state after login.

Next, we'll create our User model with the information required for authentication and authorization. Since users should only be created by an administrator, we won't expose a public registration endpoint.

Now we'll implement the admin user creation flow. Only an authenticated administrator will be able to create new users, while regular employees will only receive their credentials and use them to log in.

Before storing user credentials, we need to protect their passwords. We'll hash passwords using a secure hashing algorithm such as bcrypt, ensuring that plain-text passwords are never stored in our database.

6. read /knowledge.md and With user creation in place, let's build the login endpoint. Any user created by an administrator can authenticate using their credentials, and after successful verification, the server will generate a JWT containing the information needed to identify the logged-in user.

7. read /knowledge.md and Next, we'll create authentication middleware to protect our API routes. It will extract the JWT from the request, verify its signature, and attach the authenticated user's information to the request before allowing the request to continue.

Authentication tells us who the user is, but we also need to control what they can do. We'll add role-based authorization so we can restrict sensitive operations to administrators while allowing employees to access only the features they're permitted to use.

8. read /knowledge.md and Finally, we'll add an endpoint for retrieving the currently logged-in user. This allows the frontend to restore the user's session, display their information, and determine which parts of the employee management system they should have access to.

9. read /knowledge.md and integrate the frontend with tanstack query + axios to handle API requests and manage state. We'll set up a query client, create hooks for fetching and mutating data, and ensure that our frontend components can easily access the backend endpoints. This will streamline data fetching, caching, and synchronization between the frontend and backend.

When I sign out, I should not see my profile- before refreshing the page, although when I refresh the page sign out was successful.

10. read /knowledge.md and let work on the login. The home page will have a login form where users can enter their credentials(A well designed page). Upon submission, the frontend will send a request to the backend's login endpoint, which will validate the credentials and return a JWT if successful. The frontend will then store this token securely and use it for subsequent authenticated requests.

11. read /knowledge.md and If user is logged in, they should be redirected to the dashboard page - if they are on the home page -> home page. The other pages should be protected and only accessible to authenticated users. If an unauthenticated user tries to access a protected route, they should be redirected back to the login page. Will only be having one public route which is the home page - Containing login form. Use React router layout to group the protected routes and apply the authentication middleware to them. This ensures that only logged-in users can access sensitive parts of the application, while unauthenticated users are guided back to the login page.

12. read /knowledge.md and set up shadcn ui sidebar on the layout - Protected routes, these links that are visible to the user should be based on their role. For example, an employee should only see links to their profile, leave requests etc., while an admin should see links to manage users, departments, view reports, manage leaves etc. The sidebar should also include a logout button that clears the user's session and redirects them back to the login page.

13. read /knowledge.md and Implement department management features. Admins should be able to create, read, update, and delete departments, as well as assign employees to departments. Employees should be able to view their department information.

14. read /knowledge.md and Implement employee/user management features. Admins should be able to create, read, update, and delete employee records. Employees should be able to view their own profile and update certain information.

15. read /knowledge.md and Implement leave management features. Employees should be able to apply for leave, view their leave status, and cancel leave requests. Admins should be able to view all leave requests, approve or reject them, and manage leave policies.

16. read /knowledge.md and create reusable search and paginations that can be used across different modules like employees, departments, and leave requests. This will enhance the user experience by allowing users to easily find and navigate through large datasets.

17. read /knowledge.md and Add an activity log, that can only be viewed by admin, should every relevant action.

18. Select should display name instead of id, to make it readable.

19. read /knowledge.md and add a search for all selects displaying data from the backend, to make it easier for users to find specific options in dropdowns, especially when dealing with large datasets.

20. read /knowledge.md and add another role - head of department. Head of department can CRUD announcements which can be viewed by members of there department. Don't use table to display announcements - use a card.

21. read /knowledge.md and add a feature for employees to submit feedback. Admins should be able to view all feedback submissions, respond to them, and mark them as resolved. Employees should be able to view the status of their feedback and any responses from the admin.

22. read /knowledge.md and Implement a notification system that alerts users about important events, such as leave approvals, feedback responses, or announcements. Notifications should be displayed in real-time and can be accessed through a dedicated notifications panel.

23. read /knowledge.md and Implement attendance tracking features. Head of departments should be able to mark attendance for their team members, while employees can view their own attendance records. The system should allow for easy tracking of attendance trends and generate reports on attendance statistics.

24. read /knowledge.md and Implement a reporting feature that allows admins to generate reports on various aspects of the employee management system, such as employee performance, leave statistics, and department activities. Reports should be exportable in formats like PDF or Excel for easy sharing and analysis.

25. read /knowledge.md and implement email notifications for important events, such as leave approvals, feedback responses, or announcements. Users should receive email alerts in addition to in-app notifications, ensuring they stay informed even when not actively using the application. We'll use Resend to send emails, and configure the email templates to provide clear and concise information about the events. Resend already installed.

Since we are using Resend for free, we are limited to sending to only one email address - 1 domain - onboarding@resend.dev
Also use Resend so that emails don't land on the spam folder.

26. read /knowledge.md and Implement Employee Tasks. Head of departments should be able to assign tasks to their team members, set deadlines, and track progress. Employees should be able to view their assigned tasks, update their status, and submit completed work for review. The system should push notifications for new tasks.

27. read /knowledge.md and Intergrate backend with inngest.

28. read /knowledge.md and Implement a performance review system. Admins and head of departments should be able to schedule performance reviews for employees, provide feedback, and set goals for improvement. Employees should be able to view their performance reviews, acknowledge feedback, and track their progress over time. Employee:
    e.g
    John Doe

Communication 4/5
Technical Skills 5/5
Teamwork 4/5
Leadership 3/5
Overall 4.0/5 - Should be done by AI, instead of manually, we can use Gemini AI API to generate performance reviews based on employee data and feedback from managers. The system should also allow for the storage and retrieval of past performance reviews for reference and analysis. Since these is a long task, it will run on inngest.
GEMINI_API_KEY="AQ.Ab8RN6LFh5r0jaKZ8diak6IhJ660sssduioa_QyAPMezoMbhtg"

- GEMINI_API_KEY - provided in the .env

29. read /knowledge.md and add ai insights page - This page will provide AI-generated insights and recommendations based on employee data, performance metrics, and feedback. The insights can help managers make informed decisions about employee development, team dynamics, and overall organizational performance. We'll use Gemini AI API to generate these insights, ensuring that they are accurate, relevant, and actionable. The insights page should be accessible to admins and head of departments, providing them with valuable information to drive strategic decisions within the organization.

- Head of departments should be able to view insights related to their team, while admins can access organization-wide insights. The insights should be presented in a clear and visually appealing manner to highlight key findings and recommendations.

- task should be run on inngest, since it is a long task.

30. read /knowledge.md and Implement rate limiting and throttling for API requests to prevent abuse and ensure fair usage. We'll configure middleware to limit the number of requests a user can make within a specific time frame, returning appropriate error responses when limits are exceeded. This will help maintain the stability and performance of our backend services.

31. read /knowledge.md and Implement frontend toast notifications on mutations to provide users with immediate feedback on their actions. For example, when a user successfully submits a form, updates their profile, or encounters an error, a toast notification will appear to inform them of the outcome. This enhances the user experience by providing clear and timely feedback on their interactions with the application.

32. read /knowledge.md and add delete to the performances - Admin only delete, also remove scrollbar throughout the project.

33. read /knowledge.md and implement dashboard analytics for admins and head of departments. The dashboard should display key metrics and visualizations related to employee performance, leave statistics, department activities, and other relevant data. We'll use charts and graphs to present the information in an easily digestible format, allowing users to quickly assess the overall health and performance of the organization.

34. there is an issue with task status update e.g on submit task I get - Submission failed
    Internal server error, on approve task I get - Review failed Internal server error, start task - Internal server error

35. can SSE real-time be intergrated through out the project, including inngest functions, so that we can have real-time updates. -- All Mutations

36. Make sure the backend is ready to be deployed on vercel.

- FIX:
- still not logging in properly even when it does, data does not load - Couldn't load dashboard
  Not authenticated and when I refresh I back to login page

- fix, employee does not have dashboard, says forbidden
- remove Recent Activity on the dashboard of the head of department and employees
