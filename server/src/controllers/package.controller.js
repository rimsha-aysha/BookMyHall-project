import Package from "../models/Package.js";
import * as factory from "./crudFactory.js";

export const listActivePackages = factory.listActive(Package);
export const getActivePackageById = factory.getActiveById(Package);
export const listAllPackages = factory.listAll(Package);
export const createPackage = factory.createOne(Package);
export const updatePackage = factory.updateOne(Package);
export const setPackageStatus = factory.setActiveStatus(Package);
export const deletePackage = factory.deleteOneUnlessBooked(Package, "package", "package");
