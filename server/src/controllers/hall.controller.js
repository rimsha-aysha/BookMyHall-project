import Hall from "../models/Hall.js";
import Booking from "../models/Booking.js";
import * as factory from "./crudFactory.js";

export const listActiveHalls = factory.listActive(Hall);
export const getActiveHallById = factory.getActiveById(Hall);
export const listAllHalls = factory.listAll(Hall);
export const createHall = factory.createOne(Hall);
export const updateHall = factory.updateOne(Hall);
export const setHallStatus = factory.setActiveStatus(Hall);

// A hall that appears in any booking can't be hard-deleted — bookings,
// payments and reports would be left pointing at nothing. Deactivating it
// hides it from customers while keeping that history intact.
const deleteHallRecord = factory.deleteOne(Hall);
export const deleteHall = async (req, res, next) => {
  try {
    const bookingCount = await Booking.countDocuments({ hall: req.params.id });
    if (bookingCount > 0) {
      res.status(409);
      return next(
        new Error(
          `This hall has ${bookingCount} booking(s) and can't be deleted. Deactivate it instead to hide it from customers.`
        )
      );
    }
    return deleteHallRecord(req, res, next);
  } catch (error) {
    next(error);
  }
};
