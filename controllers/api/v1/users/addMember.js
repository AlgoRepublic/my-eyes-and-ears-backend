const { asyncMiddleware } = require("../../../../middlewares/async");
const { addMemberService } = require("../../../../services/user/addMember");

module.exports = asyncMiddleware(async (req, res, next) => {
  // const requestBody = {
  //   "user": {
  //     "name": "John Doe",
  //     "email": "john.doe@example.com",
  //     "phoneNumber": "1234567890",
  //     "role": "caregiver",
  //     "relation": "father",
  //     "caregiverId": "60c72b2f9b1e8e5f4c8b4567",
  //     "avatarColor": "#ff0000"
  //   },
  //   "elderMode": {
  //     "fontSize": "medium",
  //     "highContrast": true,
  //     "voiceAssistance": true
  //   },
  //   "medications": [
  //     {
  //       "name": "Medication 1",
  //       "dosage": "10mg",
  //       "frequency": "Once a day",
  //       "startDate": "2023-01-01",
  //       "endDate": "2023-01-10",
  //       "notes": "Take with food",
  //       "time": "08:00 AM"
  //     }
  //   ],
  //   "contacts": [
  //     {
  //       "name": "Contact 1",
  //       "phoneNumber": "1234567890",
  //       "relationship": "Friend"
  //     }
  //   ],
  //   "checkins": {
  //     "reminders": [
  //       {
  //         "time": "09:00 AM",
  //         //"default statuses like 'ok', 'need help', 'emergency', etc. will be in database
  //       },
  //     ],
  //     //"default statuses like 'ok', 'need help', 'emergency', etc. will be in database
  //   },
  //   "appointments": [
  //     {
  //       "doctorName": "Dr. Smith",
  //       "reason": "Regular Checkup",
  //       "date": "2023-01-15",
  //       "time": "10:00 AM",
  //       "location": "123 Main St, City, State",
  //       "rider": "John Doe"
  //     },
  //   ],
  // }

  const data = await addMemberService(req.user, req.body);

  next({
    success: true,
    message: "Member added successfully",
    statusCode: 200,
    data,
  });
});
