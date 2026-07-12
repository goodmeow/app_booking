// Mechanically recovered from immutable dist/server/server.bundle.js.
// Keep behavior stable until contract tests permit modular refactoring.
import express from "express";
import pg from "pg";
import moment from "moment";
import jwt from "jsonwebtoken";
import expressJwt from "express-jwt";
import bcrypt from "bcrypt";
import dayjs from "dayjs";
import config from "../../config/config.js";

;// ./server/pglibs/schema.js
function Schema(properties) {
  this.schema = properties;
}
/* harmony default export */ const schema = (Schema);
;// ./server/services/pgpool.js

const {
  Pool
} = pg;

let pool;
const getPool = () => {
  if (pool) {
    return pool;
  } else {
    //connecting to postgresql database
    pool = new Pool(config.pgConn);

    // the pool will emit an error on behalf of any idle clients
    // it contains if a backend error or network partition happens
    pool.on('error', (err, client) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
    return pool;
  }
};
/* harmony default export */ const pgpool = (getPool);
;// ./server/pglibs/model.js

function Model() {
  this.propModel = "Model";
  //retrieve schema defined in the pglib/index.js file
  this.connPool = {};
  this.schema = {};
  this.schema_name = {};
  this.data = [];
}

//declare fn_find which will be called in the find funct
function fn_find(options) {
  try {
    return new Promise((resolve, reject) => {
      let schema = this.schema.schema;
      const requireQuote = [String, Date];
      try {
        //table / view name
        let tableName = options.table_name;
        let strSQL;
        //generate common variable
        let strWhere = "";
        let strOrder = "";
        let strPaging = "";
        let strFts = "";

        //check table relation
        if (options.relation == true) {
          //generate where clause if exist
          if (options.where_clause) {
            options.where_clause.forEach(element => {
              if (element["column_value"]) {
                //check if column_value exist
                if (element["column_name"].indexOf('LOWER') > -1) {
                  //check if columnname contain LOWER
                  strWhere = strWhere.concat(element["column_name"], " ", element["operator"], " ", "LOWER(", requireQuote.includes(schema[element["column_name"].split('.').splice(1).join('.').slice(0, -1)].type) ? "''" : "", element["column_value"], requireQuote.includes(schema[element["column_name"].split('.').splice(1).join('.').slice(0, -1)].type) ? "''" : "", ")", " AND ");
                } else if (schema[element["column_name"].split('.').splice(1).join('.')].type == Date) {
                  //check if column type is Date
                  strWhere = strWhere.concat('DATE(' + element["column_name"] + ')', " ", element["operator"], " ", "DATE(", requireQuote.includes(schema[element["column_name"].split('.').splice(1).join('.')].type) ? "''" : "", element["column_value"], requireQuote.includes(schema[element["column_name"].split('.').splice(1).join('.')].type) ? "''" : "", ")", " AND ");
                } else {
                  strWhere = strWhere.concat(element["column_name"], " ", element["operator"], " ", requireQuote.includes(schema[element["column_name"].split('.').splice(1).join('.')].type) ? "''" : "", element["column_value"], requireQuote.includes(schema[element["column_name"].split('.').splice(1).join('.')].type) ? "''" : "", " AND ");
                }
              } else if (element["column_value1"] && element["column_value2"]) {
                strWhere = strWhere.concat('DATE(' + element["column_name"] + ')', " ", element["operator"], " ''", element["column_value1"], "'' AND ''", element["column_value2"], "'' AND ");
                // console.log('strWhere : ', strWhere)
              }
            });
            if (strWhere) {
              strWhere = strWhere.substring(0, strWhere.length - 5);
              strWhere = "WHERE " + strWhere;
            }
          }
        } else {
          if (options.where_clause) {
            options.where_clause.forEach(element => {
              if (element["column_value"]) {
                if (element["column_name"].indexOf('LOWER') > -1) {
                  //check if columnname contain LOWER
                  strWhere = strWhere.concat(element["column_name"], " ", element["operator"], " ", "LOWER(", requireQuote.includes(schema[element["column_name"].split('(').splice(1).join('.').slice(0, -1)].type) ? "''" : "", element["column_value"], requireQuote.includes(schema[element["column_name"].split('(').splice(1).join('.').slice(0, -1)].type) ? "''" : "", ")", " AND ");
                } else {
                  strWhere = strWhere.concat(element["column_name"], " ", element["operator"], " ", requireQuote.includes(schema[element["column_name"]].type) ? "''" : "", element["column_value"], requireQuote.includes(schema[element["column_name"]].type) ? "''" : "", " AND ");
                }
              }
            });
            if (strWhere) {
              strWhere = strWhere.substring(0, strWhere.length - 5);
              strWhere = "WHERE " + strWhere;
            }
          }
        }

        //generate ORDER BY clause3
        if (options.order_by_clause) {
          options.order_by_clause.forEach(element => {
            strOrder = strOrder.concat(element.column_name, " ", element.sort_by, ", ");
          });
          if (strOrder) {
            strOrder = strOrder.substring(0, strOrder.length - 2);
            strOrder = " ORDER BY " + strOrder;
          }
        }

        //generate paging options
        if (options.paging) {
          if (options.paging.page_size > 0) {
            strPaging = strPaging.concat(" LIMIT ", options.paging.page_size.toString(), " OFFSET ", ((options.paging.page_number - 1) * options.paging.page_size).toString());
          }
        }
        if (options.fts) {
          strFts = `${options.fts}:*`;
          strFts = strFts.split(' ').join('<->');
          // strFts = options.fts
        }
        if (options.function_param) {
          strSQL = `SELECT * FROM ${tableName}(${options.function_param.join(", ")})`;
        } else {
          strSQL = `SELECT * FROM ${tableName}('${strWhere}','${strOrder}','${strPaging}','${strFts}')`;
        }
        console.log(strSQL);

        //query to database
        const pool = pgpool(this.connPool);
        pool.query(strSQL, (err, res) => {
          if (err) {
            console.log(err);
            reject(err.message);
          } else {
            this.data = res.rows;
            resolve(res.rows);
          }
        });
      } catch (err) {
        console.log(err);
      }
    });
  } catch (err) {
    console.log(err);
  }
}

// declare fn_save to insert data
function fn_save(options) {
  return new Promise((resolve, reject) => {
    const schema = this.schema.schema;

    //list of column data type that requires quotes
    const requireQuote = [String, Date];
    try {
      //declare table name
      let tableName = options.table_name;

      //declare common variable
      let strColumn = "";
      let strValue = "";
      let strSQL = "";
      let strValueConcat = "";
      let strValueArr = "";
      let strValueArrConcat = "";
      let strWhereClause = "";
      let strWhereColumn = "";
      if (options.function_param) {
        strSQL = `SELECT * FROM ${tableName}(${options.function_param.join(", ")})`;
      } else {
        //insert value
        if (options.relation == true) {
          options.insert_clause.forEach(data => {
            data.forEach(element => {
              const withQuoteOrNot = requireQuote.includes(schema[element.column_name].type) ? "" : "";
              if (element.column_value || element.column_value == false) {
                strValue = strValue.concat(withQuoteOrNot, element.column_value, withQuoteOrNot, ",");
              }
            });

            //delete last ,
            if (strValue) {
              strValue = strValue.substring(0, strValue.length - 1);
              strValue = "{" + strValue + "}";
            }
            strValueConcat += strValue + ",";
            strValue = "";
          });

          // merge array value with another insert value
          strValueConcat = strValueConcat.substring(0, strValueConcat.length - 1);
          strValueConcat = "{" + strValueConcat + "}";
        } else {
          //insert value
          options.insert_clause.forEach(data => {
            data.forEach(element => {
              const withQuoteOrNot = requireQuote.includes(schema[element.column_name].type) ? "''" : "";
              strValue = strValue.concat(withQuoteOrNot, element.column_value, withQuoteOrNot, ",");
            });

            //delete last ,
            if (strValue) {
              strValue = strValue.substring(0, strValue.length - 1);
              strValue = "(" + strValue + ")";
            }
            strValueConcat += strValue + ",";
            strValue = "";
          });
          strValueConcat = strValueConcat.substring(0, strValueConcat.length - 1);
        }

        //list column to insert
        options.insert_clause[0].forEach(element => {
          if (String(element.column_value) != "") {
            strColumn = strColumn.concat(element.column_name, ",");
          }
        });
        if (strColumn) {
          strColumn = strColumn.substring(0, strColumn.length - 1);
          strColumn = options.parameter1Type === "array" ? "{" + strColumn + "}" : "(" + strColumn + ")";
        }

        //set where_clause if exist, in this case used for insert opname_details
        if (options.where_clause) {
          options.where_clause.forEach(element => {
            if (element["column_value"]) {
              const withQuoteOrNot = requireQuote.includes(schema[element.column_name.split('.').splice(1).join('.')].type) ? "''" : "";
              strWhereClause = strWhereClause.concat(element.column_name, " ", element.operator, " ", withQuoteOrNot, element.column_value, withQuoteOrNot, " AND ");
            }
          });

          //delete last , AND
          if (strWhereClause) {
            strWhereClause = strWhereClause.substring(0, strWhereClause.length - 5);
          }

          // //set strSQL
          strSQL = `SELECT * FROM ${tableName}('${strColumn}','${strValueConcat}','${strWhereClause}')`;
        } else {
          // //set strSQL
          strSQL = `SELECT * FROM ${tableName}('${strColumn}','${strValueConcat}')`;
        }
      }
      console.log(strSQL);
      // query to database,
      const pool = pgpool(this.connPool);
      pool.query(strSQL, (err, res) => {
        if (err) {
          console.log(err);
          reject(err);
        } else {
          console.log(res.rows);
          resolve(res.rows);
        }
      });
    } catch (err) {
      console.log(err);
    }
  });
}

//declare fn_update to update data
function fn_update(options) {
  return new Promise((resolve, reject) => {
    let schema = this.schema.schema;
    //list of column data type that require quotes
    const requireQuote = [String, Date];
    try {
      //declare common variable
      let tableName = options.table_name;
      let strWhere = "";
      let strSet = "";
      let strSetMerge = "";
      let strSQL = "";

      // console.log(options.update_clause)

      //check if schema's relation true
      if (options.relation == true) {
        //generate SET clause
        options.update_clause.forEach(element => {
          strSet = strSet.concat("{", element["column_name"], " ", element["operator"], " ", requireQuote.includes(schema[element["column_name"]].type) ? "''" : "", element["column_value"], requireQuote.includes(schema[element["column_name"]].type) ? "''" : "", "}", ",");
          strSetMerge += strSet;
          strSet = "";
        });
        if (strSetMerge) {
          strSetMerge = strSetMerge.substring(0, strSetMerge.length - 1);
          strSetMerge = "{" + strSetMerge + "}";
        }

        //set where clause
        options.where_clause.forEach(element => {
          // strWhere = strWhere.concat(element["column_value"])
          strWhere = strWhere.concat("{", requireQuote.includes(schema[element["column_name"]].type) ? "''" : "", element["column_value"], requireQuote.includes(schema[element["column_name"]].type) ? "''" : "", "}", ",");
        });

        //add {} to where clause
        if (strWhere) {
          strWhere = strWhere.substring(0, strWhere.length - 1);
          strWhere = "{" + strWhere + "}";
        }

        //add '' to where clause
        // if (strWhere) {
        //     strWhere = "''" + strWhere + "''"
        // }

        strSQL = `SELECT * FROM ${tableName}('${strSetMerge}', '${strWhere}')`;
      } else if (options.function_param) {
        strSet = options.function_param.join(", ");
        strSQL = `SELECT * FROM ${tableName}(${strSet})`;
      } else {
        if (options.update_clause) {
          options.update_clause.forEach(element => {
            const withQuoteOrNot = requireQuote.includes(schema[element.column_name].type) ? "''" : "";
            strSet = strSet.concat(element.column_name, " ", element.operator, " ", withQuoteOrNot, element.column_value, withQuoteOrNot, ",");
          });
          if (strSet) {
            strSet = strSet.substring(0, strSet.length - 1);
            // strSet = strSet
          }
        }
        //set where clause
        options.where_clause.forEach(element => {
          const withQuoteOrNot = requireQuote.includes(schema[element.column_name].type) ? "''" : "";
          strWhere = strWhere.concat(element.column_name, " ", element.operator, " ", withQuoteOrNot, element.column_value, withQuoteOrNot, " AND ");
        });
        if (strWhere) {
          strWhere = strWhere.substring(0, strWhere.length - 5);
        }
        strSQL = `SELECT * FROM ${tableName}('${strSet}', '${strWhere}')`;
      }
      console.log(strSQL);
      //query to database
      const pool = pgpool(this.connPool);
      pool.query(strSQL, (err, res) => {
        if (err) {
          reject(err);
        } else {
          this.data = res.rows;
          resolve(res.rows);
        }
      });
    } catch (err) {
      console.log('Error occured');
      console.log(err);
    }
  });
}

//declare fn_remove to delete data
function fn_remove(options) {
  return new Promise((resolve, reject) => {
    const schema = this.schema.schema;
    //list of column data type that require quotes
    const requireQuote = [String, Date];
    try {
      //generate WHERE clause
      let tableName = options.table_name;
      let strSQL = "";
      let strWhere = "";
      let strWhereConcat = "";

      // let strSQL = `SELECT * FROM ${tableName}('${strWhere}')`
      if (options.function_param) {
        strSQL = `SELECT * FROM ${tableName}(${options.function_param.join(", ")})`;
      } else {
        // if (options.relation == true) {
        if (options.where_clause.length) {
          for (let i = 0; i < options.where_clause.length; i++) {
            options.where_clause[i].forEach(element => {
              strWhere = strWhere.concat(requireQuote.includes(schema[element["column_name"]].type) ? "''" : "", element["column_value"], requireQuote.includes(schema[element["column_name"]].type) ? "''" : "", ",");
              // strWhere = strWhere.concat(element["column_value"])
            });

            // delete last ,
            if (strWhere) {
              strWhere = strWhere.substring(0, strWhere.length - 1);
              strWhere = "{" + strWhere + "}";
              // strWhere = "''" + strWhere + "''"
            }
            strWhereConcat += strWhere + ',';
            strWhere = "";
          }
          strWhereConcat = strWhereConcat.substring(0, strWhereConcat.length - 1);
          strWhereConcat = "{" + strWhereConcat + "}";
          strSQL = `SELECT * FROM ${tableName}('${strWhereConcat}')`;
        } else {
          options.where_clause.forEach(element => {
            strWhere = strWhere.concat(element["column_name"], " ", element["operator"], " ", requireQuote.includes(schema[element["column_name"]].type) ? "''" : "", element["column_value"], requireQuote.includes(schema[element["column_name"]].type) ? "''" : "", " AND ");
          });
          if (strWhere) {
            strWhere = strWhere.substring(0, strWhere.length - 5);
            strWhere = strWhere;
          }
          strSQL = `SELECT * FROM ${tableName}('${strWhere}')`;
        }
      }
      console.log(strSQL);
      //query to database
      const pool = pgpool(this.connPool);
      pool.query(strSQL, (err, res) => {
        if (err) {
          reject(err);
        } else {
          this.data = res.rows;
          resolve(res.rows);
        }
      });
    } catch (err) {
      console.log(err);
    }
  });
}
Model.prototype.find = fn_find;
Model.prototype.save = fn_save;
Model.prototype.update = fn_update;
Model.prototype.remove = fn_remove;
/* harmony default export */ const model = (Model);
;// ./server/pglibs/index.js



function Pgoose() {}
Pgoose.prototype.model = function (model_name, schema, pool) {
  for (let methodName in schema.methods) {
    model.prototype[methodName] = schema.methods[methodName];
  }
  const _model = new model();
  _model.schema = schema;
  _model.schema_name = model_name;
  _model.connPool = config.pool || pool;
  return _model;
};
Pgoose.prototype.Schema = schema;
/* harmony default export */ const pglibs = (new Pgoose());
;// ./server/models/events.model.js

const eventSchema = new pglibs.Schema({
  _id: {
    type: String
  },
  event_id: {
    type: String
  },
  organizer: {
    type: String
  },
  location: {
    type: String
  },
  subject: {
    type: String
  },
  description: {
    type: String
  },
  start_date: {
    type: Date
  },
  end_date: {
    type: Date
  },
  is_cancel: {
    type: Boolean
  },
  is_draft: {
    type: Boolean
  },
  is_allday: {
    type: Boolean
  },
  is_visitor: {
    type: Boolean
  },
  attendee_email: {
    type: String
  }
});
/* harmony default export */ const events_model = (pglibs.model("eventSchema", eventSchema));
;// ./server/helpers/helpers.js
/** get first and last day of a week */
const getFirstLastDateOfWeek = currDate => {
  try {
    //get weekly dates of current date
    let dt = new Date(currDate);
    dt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    dt = new Date(dt.getTime() - (dt.getDay() > 0 ? (dt.getDay() - 1) * 1000 * 60 * 60 * 24 : 6 * 1000 * 60 * 60 * 24));
    let sunday = new Date(dt.getTime() - (dt.getDay() + 1));
    let monday = new Date(dt.getTime() + 1000 * 60 * 60 * 24 * 1 - 1);
    // let tuesday = new Date(dt.getTime() + 1000 * 60 * 60 * 24 * 2 - 1);
    // let wednesday = new Date(dt.getTime() + 1000 * 60 * 60 * 24 * 3 - 1);
    // let thursday = new Date(dt.getTime() + 1000 * 60 * 60 * 24 * 4 - 1);
    // let friday = new Date(dt.getTime() + 1000 * 60 * 60 * 24 * 5 - 1);
    let saturday = new Date(dt.getTime() + 1000 * 60 * 60 * 24 * 6 - 1);

    // console.log('monday : ', monday)

    let _weekly_dates = {
      sunday: sunday,
      saturday: saturday
    };
    console.log(_weekly_dates);
    return _weekly_dates;
  } catch (err) {
    console.log(err);
  }
};

/** convert date to local time */
const ConvertDateToLocalString = par_date => {
  try {
    const the_date = new Date(par_date);
    const diff = the_date.getTimezoneOffset();
    const timezone_str = "+" + ("0" + parseInt(diff / 60) * -1).slice(-2) + ":00";
    const str_date = `${the_date.getFullYear()}-${("0" + (the_date.getMonth() + 1)).slice(-2)}-${("0" + the_date.getDate()).slice(-2)}T${("0" + the_date.getHours()).slice(-2)}:${("0" + the_date.getMinutes()).slice(-2)}:${("0" + the_date.getSeconds()).slice(-2)}${timezone_str}`;
    return str_date;
  } catch (err) {
    console.log(err);
    return false;
  }
};

/** get week number of a date */
const getWeekNumber = d => {
  try {
    var d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return [d.getUTCFullYear(), weekNo];
  } catch (err) {
    console.log(err);
    return false;
  }
};
const isEmpty = value => {
  return value == null || value === undefined || typeof value === 'undefined';
};

;// ./server/controllers/events.controller.js





/** Get all events list */
const listEvents = async (req, res) => {
  try {
    let firstDateOfWeek = req.query.start ? moment(req.query.start).format('YYYY-MM-DD') : '';
    let lastDateOfWeek = req.query.end ? moment(req.query.end).format('YYYY-MM-DD 23:59:59') : '';

    //get event data by attendee
    let listByAttendee = await events_model.find({
      table_name: "events_list_data_by_attendee",
      where_clause: [{
        column_name: "e.start_date",
        column_value1: firstDateOfWeek,
        //get only date
        column_value2: lastDateOfWeek,
        operator: "BETWEEN"
      }, {
        column_name: "e.end_date",
        column_value1: firstDateOfWeek,
        //get only date
        column_value2: lastDateOfWeek,
        operator: "BETWEEN"
      }, {
        column_name: "LOWER(ed.attendee_email)",
        //list by users
        column_value: req.query.users ? req.query.users : '',
        operator: "="
      }, {
        column_name: "LOWER(ed.attendee_email)",
        //list by rooms
        column_value: req.query.rooms ? req.query.rooms : '',
        operator: "="
      }],
      relation: true,
      date_only: true
    });
    let dataByAttendee = await listByAttendee;

    // get event data by organizer
    let listByOrganizer = await events_model.find({
      table_name: "events_list_data_by_organizer",
      where_clause: [{
        column_name: "e.start_date",
        column_value1: firstDateOfWeek,
        //get only date
        column_value2: lastDateOfWeek,
        operator: "BETWEEN"
      }, {
        column_name: "e.end_date",
        column_value1: firstDateOfWeek,
        //get only date
        column_value2: lastDateOfWeek,
        operator: "BETWEEN"
      }, {
        column_name: "LOWER(e.organizer)",
        column_value: req.query.users ? req.query.users : '',
        operator: "="
      }, {
        column_name: "LOWER(ed.attendee_email)",
        //list by rooms
        column_value: req.query.rooms ? req.query.rooms : '',
        operator: "="
      }],
      relation: true,
      date_only: true
    });
    let dataByOrganizer = await listByOrganizer;
    let data = dataByAttendee.concat(dataByOrganizer);
    let sendData = [];
    for (let i of data) {
      let sendDataObj = {
        id: i._id,
        title: i.subject,
        start: i.start_date,
        end: i.end_date,
        organizer: i.organizer,
        description: i.description,
        is_cancel: i.is_cancel,
        is_draft: i.is_draft,
        is_allday: i.is_allday,
        created_at: i.created_at,
        checked_in: i.checked_in,
        late_threshold: i.late_threshold
      };
      if (!sendData.find(element => element.id === i._id)) {
        sendData.push(sendDataObj);
      }
    }
    res.status(200).send(sendData);
    // res.status(200).send('Oke')
  } catch (err) {
    console.log(err);
    res.status(400).send({
      err: err
    });
  }
};

/** Get events detail list */
const listEventDetails = async (req, res) => {
  try {
    console.log(req.query.event_id);
    let list = await events_model.find({
      table_name: "event_details_list_data",
      where_clause: [{
        column_name: "e._id",
        //e for tbl_events
        column_value: req.query.event_id,
        operator: "="
      }],
      relation: true
    });
    let data = await list;
    res.status(200).send(data);
  } catch (err) {
    res.status(400).json({
      error: err.message
    });
  }
};

/** Create events */
const insertEvents = async (req, res) => {
  try {
    //mapping inserted data to be inserted
    if (!Array.isArray(req.body) || !req.body.length) throw Error("Bad request");
    const insertArrMerge = req.body.map(data => {
      if (new Date(data.start_date) > new Date(data.end_date)) throw new Error('start_time cannot be later than end_time');
      if (new Date(data.start_date).toDateString() !== new Date(data.end_date).toDateString()) throw new Error('Cannot be different day');
      return [{
        column_name: "organizer",
        column_value: data.organizer
      }, {
        column_name: "subject",
        column_value: data.subject
      }, {
        column_name: "description",
        column_value: data.description
      }, {
        column_name: "start_date",
        column_value: ConvertDateToLocalString(new Date(data.start_date))
      }, {
        column_name: "end_date",
        column_value: ConvertDateToLocalString(new Date(data.end_date))
      }, {
        column_name: "attendee_email",
        column_value: data.attendee_email
      }, {
        column_name: "is_visitor",
        column_value: data.attendee_email.includes(config.employeeSuffix) || data.attendee_email.includes(config.roomSuffix) ? false : true
      }];
    });
    const data = await events_model.save({
      table_name: "events_insert_data",
      insert_clause: insertArrMerge,
      relation: true
    });
    const sendData = (data === null || data === void 0 ? void 0 : data.map(element => {
      const obj = {
        id: element.id,
        title: element.subject,
        start: element.start_date,
        end: element.end_date,
        organizer: element.organizer,
        event_detail_id: element.event_detail_id,
        attendee_email: element.attendee_email,
        description: element.description,
        is_visitor: element.is_visitor
      };
      req.io.to(element.attendee_email).emit('response:event', obj);
      return obj;
    })) || [];
    res.status(200).send(sendData);
  } catch (err) {
    console.log(err);
    res.status(400).json({
      error: err.message
    });
  }
};

/** Update events */
const updateEvents = async (req, res) => {
  try {
    var _req$body$attendees, _req$body$attendees2;
    if (req.body.organizer !== req.auth.email) throw Error("Update failed, you are not the organizer of this event");
    if (new Date(req.body.start_date) > new Date(req.body.end_date)) throw new Error('start_time cannot be later than end_time');
    // Get previous attendees
    let getListAttendee = await events_model.find({
      table_name: "event_details_list_data",
      where_clause: [{
        column_name: "e._id",
        column_value: req.body.id,
        operator: "="
      }],
      relation: true
    });
    getListAttendee = getListAttendee.map(data => data.attendee_email);
    // Get updated attendees from payload
    let updatedAttendee = ((_req$body$attendees = req.body.attendees) === null || _req$body$attendees === void 0 ? void 0 : _req$body$attendees.map(data => data.attendee_email)) || [];
    // Filter to prevent duplicate attendees
    updatedAttendee = updatedAttendee.filter(data => !getListAttendee.includes(data));
    // Merge previous and updated attendees
    let listSocketRoomByAttendee = [...getListAttendee, ...updatedAttendee];
    let paramEventHeader = {
      ...req.body,
      start_date: ConvertDateToLocalString(req.body.start_date),
      end_date: ConvertDateToLocalString(req.body.end_date)
    };
    delete paramEventHeader.attendees;
    let paramListAttendees = ((_req$body$attendees2 = req.body.attendees) === null || _req$body$attendees2 === void 0 ? void 0 : _req$body$attendees2.map(data => {
      return {
        ...data,
        is_visitor: data.attendee_email.includes(config.employeeSuffix) || data.attendee_email.includes(config.roomSuffix) ? false : true
      };
    })) || [];
    let data = await events_model.update({
      table_name: "events_update_data",
      function_param: [`'${JSON.stringify(paramEventHeader)}'`, `'${JSON.stringify(paramListAttendees)}'`]
    });
    let sendData = data.map(element => {
      return {
        id: element._id,
        title: element.subject,
        start: element.start_date,
        end: element.end_date,
        organizer: element.organizer,
        description: element.description
      };
    });
    req.io.to(listSocketRoomByAttendee).emit('response:event', sendData);
    res.status(200).send(sendData);
  } catch (err) {
    console.log(err);
    res.status(400).json({
      error: err.message
    });
  }
};

/** add new attendee */
const addAttendee = async (req, res) => {
  try {
    let insert = await events_model.save({
      table_name: "event_details_new_attendee",
      insert_clause: [[{
        column_name: "event_id",
        column_value: req.body[0].event_id
      }, {
        column_name: "attendee_email",
        column_value: req.body[0].attendee_email
      }, {
        column_name: "is_visitor",
        column_value: req.body[0].attendee_email.includes(config.employeeSuffix) || req.body[0].attendee_email.includes(config.roomSuffix) ? false : true
      }]],
      relation: false
    });
    let data = await insert;
    res.status(200).send(data);
  } catch (err) {
    res.status(400).json({
      error: err.message
    });
  }
};

/** delete attendee */
const deleteAttendee = async (req, res) => {
  try {
    let remove = await events_model.remove({
      table_name: "events_delete_attendee",
      where_clause: [[{
        column_name: "_id",
        column_value: req.query.event_detail_id,
        operator: "="
      }]],
      relation: false
    });
    let data = await remove;
    res.status(200).send(data);
  } catch (err) {
    console.log(err);
    res.status(400).json({
      error: err.message
    });
  }
};

/** delete events(soft delete) */
const deleteEvents = async (req, res) => {
  try {
    var _data$;
    let data = await events_model.update({
      table_name: "events_delete_events",
      function_param: [`'${req.auth.email}'`, `'${req.query.event_id}'`]
    });
    if (((_data$ = data[0]) === null || _data$ === void 0 ? void 0 : _data$.events_delete_events) === "Delete failed") throw Error("Delete failed, you are not the organizer");
    let getListAttendee = await events_model.find({
      table_name: "event_details_list_data",
      where_clause: [{
        column_name: "e._id",
        column_value: req.query.event_id,
        operator: "="
      }],
      relation: true
    });
    let listSocketRoomByAttendee = (getListAttendee === null || getListAttendee === void 0 ? void 0 : getListAttendee.map(data => data.attendee_email)) || [];

    // emit to each of attendee email
    req.io.to(listSocketRoomByAttendee).emit('response:event', listSocketRoomByAttendee);
    res.status(200).send(data);
  } catch (err) {
    console.log(err);
    res.status(400).json({
      error: err.message || err
    });
  }
};
const checkIn = async (req, res) => {
  try {
    const {
      event_id,
      card_number
    } = req.body;
    if (!event_id || !card_number) throw Error("Some required field is missing");
    const data = await events_model.update({
      table_name: "events_checkin",
      function_param: [`'${event_id}'`, `'${card_number}'`]
    });
    if (!data || !data.length) throw Error("Check in failed");
    const result = data[0];
    if (!result.checked_in) throw Error("Check in failed");

    // emit "response:event" ke room
    req.io.to(req.auth.email).emit('response:event', result);
    res.status(200).send(result);
  } catch (error) {
    res.status(400).json({
      error: error.message || error
    });
  }
};
const earlyFinish = async (req, res) => {
  try {
    const {
      event_id
    } = req.body;
    if (!event_id) throw Error("event_id is required");
    const data = await events_model.update({
      table_name: "event_early_finished",
      function_param: [`'${event_id}'`]
    });
    if (!data || !data.length) throw Error("Action failed");
    const allAttendeeEmail = data.map(email => email.attendee_email);
    console.log(allAttendeeEmail);
    // emit "response:event" ke room
    req.io.to(allAttendeeEmail).emit('response:event', data);
    res.status(200).json(data);
  } catch (error) {
    res.status(400).json({
      error: error.message || error
    });
  }
};
/* harmony default export */ const events_controller = ({
  listEvents,
  listEventDetails,
  insertEvents,
  updateEvents,
  addAttendee,
  deleteAttendee,
  deleteEvents,
  checkIn,
  earlyFinish
});
;// ./server/models/users.model.js

const usersSchema = new pglibs.Schema({
  _id: {
    type: String
  },
  name: {
    type: String
  },
  email: {
    type: String
  },
  password: {
    type: String
  },
  hashed_password: {
    type: String
  },
  role_id: {
    type: String
  },
  type: {
    type: String
  },
  floor: {
    type: String
  },
  capacity: {
    type: String
  },
  building: {
    type: String
  },
  feature: {
    type: String
  },
  card_number: {
    type: String
  },
  is_deleted: {
    type: Boolean
  },
  created_at: {
    type: Date
  },
  updated_at: {
    type: Date
  }
});
/* harmony default export */ const users_model = (pglibs.model("usersSchema", usersSchema));
;// ./server/helpers/dbErrorHandler.js


/**
 * Get unique error field name
 */
const getUniqueErrorMessage = err => {
  let output;
  try {
    let fieldName = err.message.substring(err.message.lastIndexOf('.$') + 2, err.message.lastIndexOf('_1'));
    output = fieldName.charAt(0).toUpperCase() + fieldName.slice(1) + ' already exists';
  } catch (ex) {
    output = 'Unique field already exists';
  }
  return output;
};

/**
 * Get the error message from error object
 */
const getErrorMessage = err => {
  let message = '';
  if (err.code) {
    switch (err.code) {
      case 11000:
      case 11001:
        message = getUniqueErrorMessage(err);
        break;
      default:
        message = 'Something went wrong';
    }
  } else {
    for (let errName in err.errors) {
      if (err.errors[errName].message) message = err.errors[errName].message;
    }
  }
  return message;
};
/* harmony default export */ const dbErrorHandler = ({
  getErrorMessage
});
;// ./server/utils/bcrypt.js

const encryptPass = password => {
  const hashedPassword = bcrypt.hashSync(password, 10);
  return hashedPassword;
};
const comparePass = (unencryptedPassword, encryptedPassword) => {
  return bcrypt.compareSync(unencryptedPassword, encryptedPassword);
};

;// ./server/controllers/auth.controller.js






const signin = async (req, res) => {
  try {
    const {
      email,
      password
    } = req.body;
    if (!email || !password) throw Error("Email and password must provided");
    let user = await users_model.find({
      table_name: "users_detail",
      where_clause: [{
        column_name: "LOWER(u.email)",
        column_value: email.toLowerCase(),
        operator: "="
      }],
      relation: true
    });
    if (!user.length) throw Error("User not found");
    if (user[0].is_deleted === true) throw Error("Inactive account");
    if (!comparePass(password, user[0].password)) throw new Error("Email and password not match.");
    const token = jwt.sign({
      _id: user[0]._id,
      email: user[0].email,
      name: user[0].name,
      role: user[0].role.toUpperCase()
    }, config.jwtSecret);
    res.cookie("t", token, {
      expire: new Date() + 9999
    });
    return res.json({
      token,
      user: {
        _id: user[0]._id,
        name: user[0].name,
        email: user[0].email,
        role: user[0].role.toUpperCase()
      }
    });
  } catch (err) {
    return res.status(401).json({
      error: err.message
    });
  }
};
const signup = async (req, res) => {
  try {
    const {
      name,
      email,
      password
    } = req.body;
    if (!name, !email, !password) throw Error("All data must be filled");
    if (email.toLowerCase().includes('@room.com')) throw Error("Cannot use @room.com for user email");
    const encryptedPassword = encryptPass(password);
    const insertData = [{
      column_name: "name",
      column_value: name
    }, {
      column_name: "email",
      column_value: email
    }, {
      column_name: "password",
      column_value: encryptedPassword
    }, {
      column_name: "type",
      column_value: 'employee'
    }, {
      column_name: "role_id",
      column_value: '67e9500b-908a-497d-9d3b-54bc020700cb'
    }];
    await users_model.save({
      table_name: "users_insert_data",
      insert_clause: [insertData],
      relation: true,
      parameter1Type: "array"
    });
    return res.status(200).json({
      message: "Successfully signed up!"
    });
  } catch (err) {
    if (err.message.includes("duplicate key value violates unique constraint")) {
      err.message = "Email already exist";
    } else {
      err.message = dbErrorHandler.getErrorMessage(err) || err.message;
    }
    return res.status(400).json({
      error: err.message
    });
  }
};
const requireSignin = expressJwt({
  secret: config.jwtSecret,
  userProperty: 'auth'
});
const signout = (req, res) => {
  res.clearCookie("t");
  return res.status(200).json({
    message: "signed out"
  });
};
const hasAuthorization = (req, res, next) => {
  const authorized = req.auth.role === "ADMIN" || req.profile && req.auth && req.profile._id == req.auth._id;
  if (!authorized) {
    return res.status(403).json({
      error: "User is not authorized"
    });
  }
  next();
};
const adminOnly = (req, res, next) => {
  const authorized = req.auth.role === "ADMIN";
  if (!authorized) {
    return res.status(403).json({
      error: "User is not authorized"
    });
  }
  next();
};
const doorOpen = async (req, res) => {
  try {
    const {
      card_number
    } = req.body;
    if (!card_number) throw Error("Card number must be provided");
    const results = await users_model.find({
      table_name: "card_master_validation",
      function_param: [`'${card_number}'`]
    });
    if (!results.length) throw Error("Card number not found");
    return res.status(200).json({
      message: "Door opened"
    });
  } catch (err) {
    return res.status(400).json({
      error: err.message || err
    });
  }
};
/* harmony default export */ const auth_controller = ({
  signin,
  signup,
  signout,
  requireSignin,
  hasAuthorization,
  adminOnly,
  doorOpen
});
;// ./server/routes/events.routes.js



const router = express.Router();
router.route('/')
// requireSignin = proses pengecekan token bearer
.get(auth_controller.requireSignin, events_controller.listEvents).post(auth_controller.requireSignin, events_controller.insertEvents).put(auth_controller.requireSignin, events_controller.updateEvents);
router.route('/attendee').post(auth_controller.requireSignin, events_controller.addAttendee);
router.route('/delete').put(auth_controller.requireSignin, events_controller.deleteEvents);
router.route('/details').get(auth_controller.requireSignin, events_controller.listEventDetails).delete(auth_controller.requireSignin, events_controller.deleteAttendee);
router.route('/check-in').put(auth_controller.requireSignin, events_controller.checkIn);
router.route('/early-finish').put(auth_controller.requireSignin, events_controller.earlyFinish);
/* harmony default export */ const events_routes = (router);
;// ./server/controllers/user.controller.js




const list = async (req, res) => {
  try {
    let list = await users_model.find({
      table_name: "users_list",
      where_clause: [{
        column_name: "LOWER(u.email)",
        column_value: req.query.email ? req.query.email.toLowerCase() : '',
        operator: "="
      }],
      relation: false
    });
    let data = await list;
    res.status(200).send(data);
  } catch (err) {
    console.log(err);
    res.status(400).send(err);
  }
};
const create = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      roleId,
      card_number
    } = req.body;
    if (!name, !email, !password, !roleId) throw Error("All data must be filled");
    if (email.toLowerCase().includes("@room.com")) throw Error("You cannot use @room.com email for user");
    const encryptedPassword = encryptPass(password);
    const insertData = [{
      column_name: "name",
      column_value: name
    }, {
      column_name: "email",
      column_value: email
    }, {
      column_name: "password",
      column_value: encryptedPassword
    }, {
      column_name: "type",
      column_value: "employee"
    }, {
      column_name: "role_id",
      column_value: roleId
    }, ...(card_number ? [{
      column_name: "card_number",
      column_value: card_number
    }] : [])];
    console.log(insertData);
    await users_model.save({
      table_name: "users_insert_data",
      insert_clause: [insertData],
      relation: true,
      parameter1Type: "array"
    });
    return res.status(200).json({
      message: "Successfully signed up!"
    });
  } catch (err) {
    if (err.message.includes("duplicate key value violates unique constraint")) {
      err.message = "Email already exist";
    } else {
      err.message = dbErrorHandler.getErrorMessage(err) || err.message;
    }
    return res.status(400).json({
      error: err.message
    });
  }
};

/**
 * Load user and append to req.
 */
const userByID = async (req, res, next, id) => {
  try {
    let user = await users_model.find({
      table_name: "users_list_data",
      where_clause: [{
        column_name: "_id",
        column_value: id,
        operator: "="
      }],
      relation: false
    });
    if (!user[0]) return res.status(400).json({
      error: "User not found"
    });
    req.profile = user[0];
    next();
  } catch (err) {
    return res.status(400).json({
      error: "Could not retrieve user"
    });
  }
};
const read = (req, res) => {
  return res.json(req.profile);
};
const update = async (req, res) => {
  try {
    const {
      name,
      email,
      roleId,
      card_number
    } = req.body;
    const {
      userId
    } = req.params;
    if (!name || !email) throw Error('Name / Email is required');
    if (email.toLowerCase().includes("@room.com")) throw Error("Email cannot contain @room.com");
    let update_clause = [{
      column_name: "name",
      column_value: name
    }, {
      column_name: "email",
      column_value: email
    }];
    if (req.auth.role === "ADMIN") {
      if (roleId) {
        update_clause.push({
          column_name: "role_id",
          column_value: roleId
        });
      }
      if (card_number) {
        update_clause.push({
          column_name: "card_number",
          column_value: card_number
        });
      }
    }
    const where_clause = [{
      column_name: "_id",
      column_value: userId,
      operator: "="
    }];
    const result = await users_model.update({
      table_name: "users_update_data",
      function_param: [`'${JSON.stringify(update_clause)}'`, `'${JSON.stringify(where_clause)}'`]
    });
    if (!result.length) throw Error("Update failed");
    let data = result[0];

    // delete this key because user dont need this key. that key is for room type user only
    delete data.floor;
    delete data.capacity;
    delete data.building;
    delete data.feature;
    res.status(200).send(data);
  } catch (err) {
    console.log(err);
    return res.status(400).json({
      error: err.message
    });
  }
};
const remove = async (req, res) => {
  try {
    const update_clause = [{
      column_name: "is_deleted",
      column_value: true
    }];
    const where_clause = [{
      column_name: "_id",
      column_value: req.params.userId,
      operator: "="
    }];
    let result = await users_model.update({
      table_name: "users_update_data",
      function_param: [`'${JSON.stringify(update_clause)}'`, `'${JSON.stringify(where_clause)}'`]
    });
    if (!result.length) throw Error("Update failed");
    let data = result[0];

    // delete this key because user dont need this key. that key is for room type user only
    delete data.floor;
    delete data.capacity;
    delete data.building;
    delete data.feature;
    res.status(200).send(data);
  } catch (err) {
    return res.status(400).json({
      error: dbErrorHandler.getErrorMessage(err) || err.message
    });
  }
};
const changePassword = async (req, res) => {
  try {
    let userId;
    const {
      oldPassword,
      newPassword,
      newPasswordConfirmation
    } = req.body;
    if (req.auth.role === "ADMIN" && req.body.userId) {
      userId = req.body.userId;
    } else {
      userId = req.auth._id;
      if (!oldPassword) throw Error("Old password is required");
    }
    if (!newPassword) throw Error("New password is required");
    if (!newPasswordConfirmation) throw Error("Confirmation password is required");
    if (newPassword !== newPasswordConfirmation) throw Error("New password and confirmation password mismatch");
    const userData = await users_model.find({
      table_name: "users_detail",
      where_clause: [{
        column_name: "u._id",
        column_value: userId,
        operator: "="
      }],
      relation: true
    });
    if (userData.length === 0) throw Error("User not found");
    if ((req.auth.role !== "ADMIN" || userId === req.auth._id) && !comparePass(oldPassword, userData[0].password)) throw Error("Old password does not match");
    const encryptedNewPassword = encryptPass(newPassword);
    const update_clause = [{
      column_name: "password",
      column_value: encryptedNewPassword
    }];
    const where_clause = [{
      column_name: "_id",
      column_value: userId,
      operator: "="
    }];
    let result = await users_model.update({
      table_name: "users_update_data",
      function_param: [`'${JSON.stringify(update_clause)}'`, `'${JSON.stringify(where_clause)}'`]
    });
    if (!result.length) throw Error("Update failed");
    let data = result[0];

    // delete this key because user dont need this key. that key is for room type user only
    delete data.floor;
    delete data.capacity;
    delete data.building;
    delete data.feature;
    res.status(200).send(data);
  } catch (error) {
    console.log(error);
    res.status(400).json({
      error: dbErrorHandler.getErrorMessage(error) || error.message
    });
  }
};
/* harmony default export */ const user_controller = ({
  create,
  userByID,
  read,
  list,
  remove,
  update,
  changePassword
});
;// ./server/routes/user.routes.js



const user_routes_router = express.Router();

// requireSignin = proses pengecekan token bearer
user_routes_router.route('/').get(auth_controller.requireSignin, user_controller.list).post(auth_controller.requireSignin, auth_controller.hasAuthorization, user_controller.create);
user_routes_router.route('/change-password').put(auth_controller.requireSignin, user_controller.changePassword);
user_routes_router.route('/:userId').get(auth_controller.requireSignin, user_controller.read).put(auth_controller.requireSignin, auth_controller.hasAuthorization, user_controller.update).delete(auth_controller.requireSignin, auth_controller.hasAuthorization, user_controller.remove);
user_routes_router.param('userId', user_controller.userByID);
/* harmony default export */ const user_routes = (user_routes_router);
;// ./server/controllers/rooms.controllers.js






/** get available rooms */
const listAvailableRooms = async (req, res) => {
  try {
    let start_dates = new Date();
    let end_dates;
    if (req.query.start_dates) {
      start_dates = new Date(req.query.start_dates);
    }
    if (req.query.end_dates) {
      end_dates = new Date(req.query.end_dates);
    } else {
      //add 30 minutes for end_dates if end_dates not provided (for default)
      end_dates = new Date(start_dates);
      end_dates = end_dates.setTime(end_dates.getTime() + 30 * 60 * 1000);
    }
    let startLocalDates = ConvertDateToLocalString(start_dates);
    let endLocalDates = ConvertDateToLocalString(end_dates);

    //list already booked rooms
    let available_room = await users_model.find({
      table_name: "room_available_list",
      where_clause: [{
        column_name1: "e.start_date",
        column_name2: "e.end_date",
        column_value1: startLocalDates,
        column_value2: endLocalDates,
        operator: "BETWEEN"
      }, {
        column_name: "u.email",
        column_value: req.query.rooms ? req.query.rooms : '',
        operator: "="
      }],
      relation: true
    });
    let availableRoom = await available_room;
    res.status(200).send(availableRoom);
  } catch (err) {
    console.log(err);
    res.status(400).send(err);
  }
};

/** get all list rooms */
const listAllRooms = async (req, res) => {
  try {
    let list = await users_model.find({
      table_name: "room_list",
      where_clause: [{
        column_name: "building",
        column_value: req.query.building ? req.query.building : '',
        operator: "="
      }, {
        column_name: "capacity",
        column_value: req.query.capacity ? req.query.capacity : '',
        operator: "="
      }, {
        column_name: "floor",
        column_value: req.query.floor ? req.query.floor : '',
        operator: "="
      }],
      relation: false
    });
    let data = await list;
    res.status(200).send(data);
  } catch (err) {
    res.status(400).send(err);
  }
};
const createRoom = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      building,
      capacity,
      floor,
      feature,
      roleId
    } = req.body;
    if (!name, !email, !password, !roleId) throw Error("Some required field is missing");
    if (!email.toLowerCase().includes("@room.com")) throw Error("Email must end with @room.com");
    const encryptedPassword = encryptPass(password);
    const insertData = [{
      column_name: "name",
      column_value: name
    }, {
      column_name: "email",
      column_value: email.toLowerCase()
    }, {
      column_name: "password",
      column_value: encryptedPassword
    }, {
      column_name: "type",
      column_value: "room"
    }, {
      column_name: "building",
      column_value: building || '-'
    }, {
      column_name: "capacity",
      column_value: capacity || '-'
    }, {
      column_name: "floor",
      column_value: floor || '-'
    }, {
      column_name: "feature",
      column_value: feature || '-'
    }, {
      column_name: "role_id",
      column_value: roleId
    }];
    await users_model.save({
      table_name: "users_insert_data",
      insert_clause: [insertData],
      relation: true,
      parameter1Type: "array"
    });
    return res.status(200).json({
      message: "Successfully signed up!"
    });
  } catch (error) {
    if (error.message.includes("duplicate key value violates unique constraint")) {
      error.message = "Email room already exist";
    }
    res.status(400).json({
      error: error.message
    });
  }
};
const detailRoom = async (req, res) => {
  try {
    const user = await users_model.find({
      table_name: "room_detail",
      where_clause: [{
        column_name: "_id",
        column_value: req.params.roomId,
        operator: "="
      }],
      relation: false
    });
    if (!user[0]) return res.status(400).json({
      error: "User not found"
    });
    res.status(200).json(user[0]);
  } catch (err) {
    return res.status(400).json({
      error: "Could not retrieve user"
    });
  }
};
const updateRoom = async (req, res) => {
  try {
    const {
      name,
      email,
      building,
      capacity,
      floor,
      feature,
      roleId
    } = req.body;
    const {
      roomId
    } = req.params;
    if (!name, !email, !roleId) throw Error("Some required field is missing");
    if (!email.toLowerCase().includes("@room.com")) throw Error("Email must end with @room.com");
    const update_clause = [{
      column_name: "name",
      column_value: name
    }, {
      column_name: "email",
      column_value: email
    }, {
      column_name: "building",
      column_value: building || '-'
    }, {
      column_name: "capacity",
      column_value: capacity || '-'
    }, {
      column_name: "floor",
      column_value: floor || '-'
    }, {
      column_name: "feature",
      column_value: feature || '-'
    }, {
      column_name: "role_id",
      column_value: roleId
    }];
    const where_clause = [{
      column_name: "_id",
      column_value: roomId,
      operator: "="
    }];
    const result = await users_model.update({
      table_name: "users_update_data",
      function_param: [`'${JSON.stringify(update_clause)}'`, `'${JSON.stringify(where_clause)}'`]
    });
    if (!result.length) throw Error("Update failed");
    let data = result[0];
    res.status(200).send(data);
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
};
const deleteRoom = async (req, res) => {
  try {
    const update_clause = [{
      column_name: "is_deleted",
      column_value: true
    }];
    const where_clause = [{
      column_name: "_id",
      column_value: req.params.roomId,
      operator: "="
    }];
    let result = await users_model.update({
      table_name: "users_update_data",
      function_param: [`'${JSON.stringify(update_clause)}'`, `'${JSON.stringify(where_clause)}'`]
    });
    if (!result.length) throw Error("Update failed");
    let data = result[0];
    res.status(200).send(data);
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
};
const getReportRoomsUsage = async (req, res) => {
  try {
    const {
      start,
      end
    } = req.query;
    if (!start, !end) throw new Error('start/end parameter is required');
    if (!dayjs(start).isValid()) throw new Error(`Invalid parameter 'start'`);
    if (!dayjs(end).isValid()) throw new Error(`Invalid parameter 'end'`);
    if (dayjs(start).isAfter(end)) throw new Error('Start date cannot be after the end date');
    const result = await users_model.find({
      table_name: 'report_rooms_usage',
      function_param: [`'${start}'`, `'${end}'`]
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      error: error.message || error
    });
  }
};
/* harmony default export */ const rooms_controllers = ({
  listAvailableRooms,
  listAllRooms,
  createRoom,
  detailRoom,
  updateRoom,
  deleteRoom,
  getReportRoomsUsage
});
;// ./server/routes/rooms.routes.js



const rooms_routes_router = express.Router();

// requireSignin = proses pengecekan token bearer
rooms_routes_router.route('/').get(auth_controller.requireSignin, rooms_controllers.listAllRooms).post(auth_controller.requireSignin, auth_controller.adminOnly, rooms_controllers.createRoom);
rooms_routes_router.route('/available').get(auth_controller.requireSignin, rooms_controllers.listAvailableRooms);
rooms_routes_router.route('/usage-report').get(auth_controller.requireSignin, auth_controller.adminOnly, rooms_controllers.getReportRoomsUsage);
rooms_routes_router.route('/:roomId').get(auth_controller.requireSignin, rooms_controllers.detailRoom).put(auth_controller.requireSignin, auth_controller.adminOnly, rooms_controllers.updateRoom).delete(auth_controller.requireSignin, auth_controller.adminOnly, rooms_controllers.deleteRoom);
/* harmony default export */ const rooms_routes = (rooms_routes_router);
;// ./server/routes/auth.routes.js


const auth_routes_router = express.Router();
auth_routes_router.route('/signin').post(auth_controller.signin);
auth_routes_router.route('/signup').post(auth_controller.signup);
auth_routes_router.route('/signout').get(auth_controller.signout);
/* harmony default export */ const auth_routes = (auth_routes_router);
;// ./server/models/settings.model.js

const settingSchema = new pglibs.Schema({
  _id: {
    type: String
  },
  lock_timer: {
    type: Number
  },
  led_timer: {
    type: Number
  },
  table_input: {
    type: Boolean
  },
  not_checked_in_time_limit: {
    type: Number
  },
  time_of_event_start_soon: {
    type: Number
  },
  available_color: {
    type: String
  },
  will_start_color: {
    type: String
  },
  on_meeting_color: {
    type: String
  }
});
/* harmony default export */ const settings_model = (pglibs.model("settingSchema", settingSchema));
;// ./server/models/cardMaster.model.js

const cardMasterSchema = new pglibs.Schema({
  _id: {
    type: String
  },
  card_number: {
    type: String
  },
  created_at: {
    type: Date
  },
  created_by: {
    type: String
  },
  updated_at: {
    type: Date
  },
  updated_by: {
    type: String
  }
});
/* harmony default export */ const cardMaster_model = (pglibs.model("cardMasterSchema", cardMasterSchema));
;// ./server/controllers/setting.controller.js



const getAppSettings = async (req, res) => {
  try {
    const results = await settings_model.find({
      table_name: "settings_get_data"
    });
    const settingsData = results[0];
    res.status(200).json(settingsData || {});
  } catch (error) {
    res.status(400).json({
      error: error.message || error
    });
  }
};
const updateAppSettings = async (req, res) => {
  try {
    const {
      id,
      lock_timer,
      led_timer,
      table_input,
      not_checked_in_time_limit,
      time_of_event_start_soon,
      available_color,
      will_start_color,
      on_meeting_color
    } = req.body;
    if (!id) throw new Error('id is required');
    if (isEmpty(lock_timer) || isEmpty(led_timer) || isEmpty(table_input) || isEmpty(not_checked_in_time_limit) || isEmpty(time_of_event_start_soon) || isEmpty(available_color) || isEmpty(will_start_color) || isEmpty(on_meeting_color)) throw new Error('Some parameter is missing');
    if (isNaN(lock_timer)) throw new Error('lock_timer must be a number');
    if (isNaN(led_timer)) throw new Error('led_timer must be a number');
    if (typeof table_input !== 'boolean' && !['true', 'false'].includes(table_input)) throw new Error('table_input must be a boolean value');
    if (isNaN(not_checked_in_time_limit)) throw new Error('not_checked_in_time_limit must be a number');
    if (isNaN(time_of_event_start_soon)) throw new Error('time_of_event_start_soon must be a number');
    const results = await settings_model.update({
      table_name: "settings_update",
      function_param: [`'${JSON.stringify(req.body)}'`]
    });
    const roomList = results.map(roomEmail => roomEmail.room_list);
    req.io.to(roomList).emit('response:setting', req.body);
    res.status(200).json({
      status: "updated",
      message: "Setting successfully updated"
    });
  } catch (error) {
    res.status(400).json({
      error: error.message || error
    });
  }
};
const getCardMaster = async (req, res) => {
  try {
    const {
      card_number
    } = req.query;
    const results = await cardMaster_model.find({
      table_name: "card_master_get_data",
      where_clause: [{
        column_name: "tcm.card_number",
        column_value: (card_number === null || card_number === void 0 ? void 0 : card_number.toLowerCase()) || "",
        operator: "="
      }],
      relation: true
    });
    res.status(200).json(results || []);
  } catch (error) {
    res.status(400).json({
      error: error.message || error
    });
  }
};
const createCardMaster = async (req, res) => {
  try {
    const {
      card_number
    } = req.body;
    const user_created = req.auth._id;
    if (!card_number) throw new Error('card_number is required');
    const results = await cardMaster_model.save({
      table_name: "card_master_insert_data",
      function_param: [`'${card_number}'`, `'${user_created}'`]
    });
    res.status(201).json({
      status: "created",
      message: "Card successfully created"
    });
  } catch (error) {
    if (error.code === '23505') {
      error.message = "Card number already exist";
    }
    res.status(400).json({
      error: error.message || error
    });
  }
};
const updateCardMaster = async (req, res) => {
  try {
    const {
      card_number
    } = req.body;
    const {
      idCardMaster
    } = req.params;
    const user_updated = req.auth._id;
    if (!card_number || !idCardMaster) throw new Error('card_number or idCardMaster is required');
    const results = await cardMaster_model.update({
      table_name: "card_master_update_data",
      function_param: [`'${idCardMaster}'`, `'${card_number}'`, `'${user_updated}'`]
    });
    res.status(200).json({
      status: "updated",
      message: "Card successfully updated"
    });
  } catch (error) {
    if (error.code === '23505') {
      error.message = "Card number already exist";
    }
    res.status(400).json({
      error: error.message || error
    });
  }
};
const deleteCardMaster = async (req, res) => {
  try {
    const {
      idCardMaster
    } = req.params;
    if (!idCardMaster) throw new Error('idCardMaster is required');
    const results = await cardMaster_model.remove({
      table_name: "card_master_delete_data",
      function_param: [`'${idCardMaster}'`]
    });
    res.status(200).json({
      status: "deleted",
      message: "Card successfully deleted"
    });
  } catch (error) {
    res.status(400).json({
      error: error.message || error
    });
  }
};
/* harmony default export */ const setting_controller = ({
  getAppSettings,
  updateAppSettings,
  getCardMaster,
  createCardMaster,
  updateCardMaster,
  deleteCardMaster
});
;// ./server/routes/setting.routes.js



const setting_routes_router = express.Router();
setting_routes_router.route('/')
// requireSignin = proses pengecekan token bearer
.get(auth_controller.requireSignin, setting_controller.getAppSettings).put(auth_controller.requireSignin, setting_controller.updateAppSettings);
setting_routes_router.route('/card-master').get(auth_controller.requireSignin, setting_controller.getCardMaster).post(auth_controller.requireSignin, setting_controller.createCardMaster);
setting_routes_router.route('/card-master/:idCardMaster').put(auth_controller.requireSignin, setting_controller.updateCardMaster).delete(auth_controller.requireSignin, setting_controller.deleteCardMaster);
/* harmony default export */ const setting_routes = (setting_routes_router);
;// ./server/routes/index.js


// Import Routes Here






const routes_router = express.Router();

//Init Router
routes_router.use("/auth", auth_routes);
routes_router.use("/events", events_routes);
routes_router.use("/users", user_routes);
routes_router.use("/rooms", rooms_routes);
routes_router.use("/settings", setting_routes);
routes_router.post("/door-open", auth_controller.requireSignin, auth_controller.doorOpen);
/* harmony default export */ const routes = (routes_router);

export default routes;
