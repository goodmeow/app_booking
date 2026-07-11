-- Generated from immutable bjb.sql by database/scripts/generate-migrations.mjs.
-- Twenty-eight legacy PL/pgSQL functions.
-- Legacy OWNER TO postgres clauses intentionally removed.
\set ON_ERROR_STOP on

BEGIN;
CREATE FUNCTION public.card_master_delete_data(param_id_card_master character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
	DECLARE
		row_affected INTEGER;
	BEGIN
		DELETE FROM
			tbl_card_masters
		WHERE
			_id = param_id_card_master::uuid;
		GET DIAGNOSTICS row_affected = ROW_COUNT;
		IF row_affected > 0 THEN
			RETURN 'Success delete card master';
		ELSE
			RAISE EXCEPTION 'Failed, data card master not found';
		END IF;
	END;
$$;

CREATE FUNCTION public.card_master_get_data(where_clause text, order_clause text, paging text, fts text) RETURNS TABLE(_id uuid, card_number character varying, created_by character varying, updated_by character varying)
    LANGUAGE plpgsql
    AS $$
	BEGIN
		RETURN QUERY EXECUTE ('
			SELECT
				tcm._id,
				tcm.card_number,
				tu.name AS created_by,
				tu2.name AS updated_by
			FROM
				tbl_card_masters tcm
			LEFT JOIN
				tbl_users tu ON tcm.created_by = tu._id
			LEFT JOIN
				tbl_users tu2 ON tcm.updated_by = tu2._id'
			|| where_clause
		);
	END;
$$;

CREATE FUNCTION public.card_master_insert_data(param_card_number character varying, param_user_created character varying) RETURNS TABLE(id uuid, card_number character varying, created_at timestamp without time zone, created_by uuid)
    LANGUAGE plpgsql
    AS $$
	BEGIN
		RETURN QUERY EXECUTE ('
			INSERT INTO
				tbl_card_masters (card_number, created_by)
				VALUES ('''|| param_card_number ||''', '''|| param_user_created ||''')
			RETURNING
				_id AS id ,
				card_number ,
				created_at ,
				created_by
		');
	END;
$$;

CREATE FUNCTION public.card_master_update_data(param_id_card_master character varying, param_card_number character varying, param_user_updated character varying) RETURNS TABLE(id uuid, card_number character varying, updated_at timestamp without time zone, updated_by uuid)
    LANGUAGE plpgsql
    AS $$
	BEGIN
		RETURN QUERY EXECUTE('
			UPDATE
				tbl_card_masters
			SET
				card_number = '''|| param_card_number ||''',
				updated_at = NOW(),
				updated_by = '''|| param_user_updated ||'''
			WHERE
				_id = '''|| param_id_card_master ||'''
			RETURNING
				_id AS id ,
				card_number ,
				updated_at ,
				updated_by
		');
	END;
$$;

CREATE FUNCTION public.card_master_validation(c_number character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
	BEGIN
		PERFORM
			tcm.card_number
		FROM
			tbl_card_masters tcm
		WHERE
			LOWER(tcm.card_number) = LOWER(c_number);
		IF FOUND THEN
			RETURN 'Door Opened';
		ELSE
			RAISE EXCEPTION 'Card not registered';
		END IF;
	END;
$$;

CREATE FUNCTION public.event_details_delete_data(strwhere character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
		BEGIN
			EXECUTE ('DELETE FROM tbl_event_details WHERE _id = '||strWhere[1][1]);
			RETURN 'Success delete data';
		END;
	$$;

CREATE FUNCTION public.event_details_list_data(where_clause text, order_clause text, paging text, fts text) RETURNS TABLE(_id uuid, attendee_email character varying, is_visitor boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
			RETURN QUERY EXECUTE (
				'
					SELECT
						ed._id,
						ed.attendee_email,
						ed.is_visitor
					FROM
						tbl_events e,
						tbl_event_details ed
					WHERE
						e._id = ed.event_id
						AND '||SUBSTRING(where_clause, 6)
			);
		END;
$$;
SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE FUNCTION public.event_details_new_attendee(columnname character varying, columnvalue character varying) RETURNS SETOF public.tbl_event_details
    LANGUAGE plpgsql
    AS $$
		BEGIN
			RETURN QUERY EXECUTE (
				'INSERT INTO tbl_event_details '||columnname||' VALUES '||columnvalue||' RETURNING *'
			);
		END;
	$$;

CREATE FUNCTION public.event_early_finished(param_event_id character varying) RETURNS TABLE(attendee_email character varying)
    LANGUAGE plpgsql
    AS $$
	DECLARE
		row_affected INTEGER;
	BEGIN
		UPDATE tbl_events SET end_date = NOW() WHERE _id = param_event_id::uuid;
		GET DIAGNOSTICS row_affected = ROW_COUNT;
		IF row_affected > 0 THEN
			RETURN QUERY SELECT ted.attendee_email FROM tbl_event_details ted WHERE ted.event_id = param_event_id::uuid;
		ELSE
			RAISE EXCEPTION 'Failed, event not found';
		END IF;
	EXCEPTION
		WHEN OTHERS THEN
		RAISE;
	END;
$$;

CREATE FUNCTION public.events_checkin(param_event_id uuid, param_card_number character varying) RETURNS TABLE(_id uuid, organizer character varying, subject character varying, description character varying, start_date timestamp without time zone, end_date timestamp without time zone, checked_in timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
-- 	Begin transaction
	BEGIN

		-- Check if card_number given belongs to the organizer / one of attendees
		PERFORM card_number FROM (
			SELECT cm.card_number FROM tbl_card_masters cm
			UNION
			SELECT u.card_number FROM tbl_event_details ed JOIN tbl_users u ON ed.attendee_email = u.email WHERE ed.event_id = param_event_id
			UNION
			SELECT u.card_number FROM tbl_events e JOIN tbl_users u ON e.organizer = u.email WHERE e._id = param_event_id
		) AS subquery
		WHERE card_number = param_card_number;

        -- Condition if query above returning a row
		IF FOUND THEN
			-- Update checked_in
			UPDATE tbl_events SET checked_in = NOW()
			WHERE tbl_events._id = param_event_id
			RETURNING tbl_events._id, tbl_events.organizer, tbl_events.subject, tbl_events.description, tbl_events.start_date, tbl_events.end_date, tbl_events.checked_in
			INTO _id, organizer, subject, description, start_date, end_date, checked_in;

			RETURN NEXT;
        -- Condition if query not returning a row
		ELSE
			RETURN NEXT;
		END IF;

	EXCEPTION
	-- Rollback the transaction in case of an error
        WHEN OTHERS THEN
			-- Rollback the transaction
			-- Raise the error again to propagate it
            RAISE;
    END;
END;
$$;

CREATE FUNCTION public.events_delete_attendee(strwhere character varying[]) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
		BEGIN
			FOR i in 1..ARRAY_LENGTH(ARRAY[strWhere], 2) LOOP
				EXECUTE ('DELETE FROM tbl_event_details WHERE _id = '||strWhere[i][1]);
			END LOOP;
			RETURN 'Success deleted data';
		END;
	$$;

CREATE FUNCTION public.events_delete_events(strset character varying, strwhere character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
		BEGIN
            -- Check if user is organizer
            PERFORM organizer
            FROM tbl_events
            WHERE _id = strwhere::uuid AND organizer = strset;

            IF FOUND THEN
			    EXECUTE 'UPDATE tbl_events SET is_cancel = true, updated_at = NOW() WHERE _id = '|| quote_literal(strWhere);
			    RETURN 'Success deleted data';

            ELSE
                RETURN 'Delete failed';

            END IF;
		END;
	$$;

CREATE FUNCTION public.events_insert_data(columnname character varying, columnvalue character varying[]) RETURNS TABLE(id uuid, event_detail_id uuid, organizer character varying, subject character varying, description character varying, start_date timestamp without time zone, end_date timestamp without time zone, attendee_email character varying, is_visitor boolean)
    LANGUAGE plpgsql
    AS $$
		DECLARE
			eId uuid;
		BEGIN
--          loop to check room is booked or not
            FOR i in 1..ARRAY_LENGTH(ARRAY[columnValue], 2) LOOP
                IF columnvalue[i][6] ILIKE '%@room.com%' THEN
                    PERFORM
                        ed.attendee_email
                    FROM
                        tbl_event_details ed
                    LEFT JOIN
                        tbl_events e ON ed.event_id = e._id
                    WHERE
                        ed.attendee_email = columnvalue[i][6]
                        AND (e.start_date BETWEEN columnvalue[i][4]::timestamp AND columnvalue[i][5]::timestamp
                             OR e.end_date BETWEEN columnvalue[i][4]::timestamp AND columnvalue[i][5]::timestamp)
                        AND e.is_cancel = false;

                    -- Condition if query above returning a row
                    IF FOUND THEN
                    -- Raise an exception
                        RAISE EXCEPTION 'This room already booked on that time';
                    -- Condition if query not returning a row
                    ELSE
                        CONTINUE;
                    END IF;
                ELSE
                    CONTINUE;
                END IF;
            END LOOP;

-- 			insert data into tbl_events
			INSERT INTO tbl_events
				(organizer, subject, description, start_date, end_date)
				VALUES
				(columnvalue[1][1], columnvalue[1][2], columnvalue[1][3], columnvalue[1][4]::timestamp, columnvalue[1][5]::timestamp) RETURNING _id INTO eId;
-- 			insert into tbl_event_details
			FOR i in 1..ARRAY_LENGTH(ARRAY[columnValue], 2) LOOP
				INSERT INTO tbl_event_details
					(event_id, attendee_email, is_visitor)
					VALUES
					(eId, columnvalue[i][6], columnvalue[i][7]::boolean);
			END LOOP;

-- 			return query select
			RETURN QUERY EXECUTE (
				'
					SELECT
						e._id AS id,
						ed._id AS event_detail_id,
						e.organizer,
						e.subject,
						e.description,
						e.start_date,
						e.end_date,
						ed.attendee_email,
						ed.is_visitor
					FROM
						tbl_events e,
						tbl_event_details ed
					WHERE
						e._id = ed.event_id
						AND e._id = '''||eId||'''
				'
			);
		END;

$$;

CREATE FUNCTION public.events_list_data_by_attendee(where_clause text, order_clause text, paging text, fts text) RETURNS TABLE(_id uuid, organizer character varying, subject character varying, description character varying, start_date timestamp without time zone, end_date timestamp without time zone, is_cancel boolean, is_draft boolean, is_allday boolean, created_at timestamp without time zone, checked_in timestamp without time zone, late_threshold integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
			RETURN QUERY EXECUTE (
				'
					SELECT
						e._id,
						e.organizer,
						e.subject,
						e.description,
						e.start_date,
						e.end_date,
						e.is_cancel,
						e.is_draft,
						e.is_allday,
						e.created_at,
						e.checked_in,
						e.late_threshold
					FROM
						tbl_events e,
						tbl_event_details ed,
						tbl_users u '
					||where_clause||
					' AND e._id = ed.event_id
					  AND ed.attendee_email = u.email
					  AND e.is_cancel = false'
			);
		END;
$$;

CREATE FUNCTION public.events_list_data_by_organizer(where_clause text, order_clause text, paging text, fts text) RETURNS TABLE(_id uuid, organizer character varying, subject character varying, description character varying, start_date timestamp without time zone, end_date timestamp without time zone, is_cancel boolean, is_draft boolean, is_allday boolean, created_at timestamp without time zone, checked_in timestamp without time zone, late_threshold integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
			RETURN QUERY EXECUTE (
				'
					SELECT
						e._id,
						e.organizer,
						e.subject,
						e.description,
						e.start_date,
						e.end_date,
						e.is_cancel,
						e.is_draft,
						e.is_allday,
						e.created_at,
						e.checked_in,
						e.late_threshold
					FROM
						tbl_events e,
						tbl_users u '
					||where_clause||
					'
					  AND LOWER(e.organizer) = LOWER(u.email)
					  AND e.is_cancel = false'
			);
		END;
$$;

CREATE FUNCTION public.events_update_data(event_header jsonb, attendees_list jsonb) RETURNS TABLE(_id uuid, organizer character varying, subject character varying, description character varying, start_date timestamp without time zone, end_date timestamp without time zone)
    LANGUAGE plpgsql
    AS $_$-- 	Begin transaction
	BEGIN
--      loop to check room is booked or not
        FOR i IN 0 .. jsonb_array_length(attendees_list) - 1 LOOP
            IF attendees_list->i->>'attendee_email' ILIKE '%@room.com%' THEN
                PERFORM
                    ed.attendee_email
                FROM
                    tbl_event_details ed
                LEFT JOIN
                    tbl_events e ON ed.event_id = e._id
                WHERE
                    ed.attendee_email = attendees_list->i->>'attendee_email'
                    AND (e.start_date BETWEEN (event_header->>'start_date')::timestamp AND (event_header->>'end_date')::timestamp
                         OR e.end_date BETWEEN (event_header->>'start_date')::timestamp AND (event_header->>'end_date')::timestamp)
                    AND e.is_cancel = false
                    AND e._id != (event_header->>'id')::uuid;

                -- Condition if query above returning a row
                IF FOUND THEN
                -- Raise an exception
                    RAISE EXCEPTION 'This room already booked on that time';
                -- Condition if query not returning a row
                ELSE
                    CONTINUE;
                END IF;
            ELSE
                CONTINUE;
            END IF;
        END LOOP;
-- 		Updating event header
		EXECUTE (
	'UPDATE tbl_events SET organizer = $1, subject = $2, description = $3, start_date = $4, end_date = $5, updated_at = NOW()  WHERE _id = $6'
	) USING
		event_header->>'organizer', event_header->>'subject',
		event_header->>'description', (event_header->>'start_date')::timestamp,
		(event_header->>'end_date')::timestamp, (event_header->>'id')::uuid;

-- 		Delete all attendees then insert all attendees given
		EXECUTE (
			'DELETE FROM tbl_event_details WHERE event_id = $1'
		) USING (event_header->>'id')::uuid;

-- 		Insert with loop
		FOR i IN 0 .. jsonb_array_length(attendees_list) - 1 LOOP
			EXECUTE(
				'INSERT INTO tbl_event_details (event_id, attendee_email, is_visitor) VALUES ($1, $2, $3)'
			) USING
			(event_header->>'id')::uuid, attendees_list->i->>'attendee_email', (attendees_list->i->>'is_visitor')::boolean;
		END LOOP;

    RETURN QUERY EXECUTE (
        'SELECT e._id, e.organizer, e.subject, e.description, e.start_date, e.end_date FROM tbl_events e WHERE e._id = $1'
    ) USING (event_header->>'id')::uuid;
    EXCEPTION
        -- Rollback the transaction in case of an error
        WHEN OTHERS THEN
        -- Rollback the transaction
        -- Raise the error again to propagate it
            RAISE;
    END;
$_$;

CREATE FUNCTION public.events_update_data_old(strset character varying[], strwhere character varying[]) RETURNS TABLE(_id uuid, organizer character varying, subject character varying, description character varying, start_date timestamp without time zone, end_date timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
			RAISE NOTICE '%',strSet[1][1];
			RAISE NOTICE '%',strSet[2][1];
			RAISE NOTICE '%',strSet[1][3];
			RAISE NOTICE '%',strSet[1][4];
			RAISE NOTICE '%',strSet[1][5];
			EXECUTE ('UPDATE tbl_events SET '|| strSet[1][1] ||' ,'|| strSet[2][1] ||' ,'|| strSet[3][1] ||' ,'|| strSet[4][1] ||' ,'|| strSet[5][1] ||', updated_at = NOW() WHERE _id = '||strWhere[1][1]);

			RETURN QUERY EXECUTE (
				'
					SELECT
						e._id,
						e.organizer,
						e.subject,
						e.description,
						e.start_date,
						e.end_date
					FROM
						tbl_events e
					WHERE
						e._id = '||strWhere[1][1]


			);
		END;
$$;

CREATE FUNCTION public.report_rooms_usage(param_start_date character varying, param_end_date character varying) RETURNS TABLE(room_name character varying, room_mail character varying, total_pemakaian text, list_meeting jsonb)
    LANGUAGE plpgsql
    AS $$
	BEGIN
		RETURN QUERY SELECT
			tu2.name AS room_name ,
			tu2.email AS room_mail ,
			COALESCE(fnl.total_pemakaian, '00:00:00') AS total_pemakaian ,
			COALESCE(fnl.list_meeting, '[]'::jsonb) AS list_meeting
		FROM
			tbl_users tu2
		LEFT JOIN
			(
				SELECT
					us.name AS room_name,
					us.email AS email_room,
					COALESCE(TO_CHAR(SUM(te.end_date - te.start_date), 'HH24:MI:SS'),'00:00:00') AS total_pemakaian,
					(
						SELECT
							JSONB_AGG(
								JSON_BUILD_OBJECT(
									'id', te2._id ,
									'subject', te2.subject ,
									'start_date', te2.start_date ,
									'end_date', te2.end_date ,
									'organizer', te2.organizer ,
									'checked_in', te2.checked_in ,
									'description', te2.description
								)
							)
						FROM
							tbl_events te2
						LEFT JOIN
							tbl_event_details ted2 on te2._id = ted2.event_id
						WHERE
							ted2.attendee_email = us.email
							AND te2.is_cancel = FALSE
							AND te2.start_date BETWEEN param_start_date::TIMESTAMP AND param_end_date::TIMESTAMP + INTERVAL '1 day' - INTERVAL '1 second'
							AND te2.end_date BETWEEN param_start_date::TIMESTAMP AND param_end_date::TIMESTAMP + INTERVAL '1 day' - INTERVAL '1 second'
					) AS list_meeting
				FROM
					(SELECT
						tu.name,
						tu.email
					FROM
						tbl_users tu
					WHERE
						tu.email ILIKE '%@room.com%'
						AND tu.email != 'room@room.com'
						AND (tu.is_deleted IS NULL OR tu.is_deleted = FALSE)) us
				LEFT JOIN
					tbl_event_details ted ON us.email = ted.attendee_email
				LEFT JOIN
					tbl_events te ON ted.event_id = te._id
				WHERE
					te.start_date BETWEEN param_start_date::TIMESTAMP AND param_end_date::TIMESTAMP + INTERVAL '1 day' - INTERVAL '1 second'
					AND te.end_date BETWEEN param_start_date::TIMESTAMP AND param_end_date::TIMESTAMP + INTERVAL '1 day' - INTERVAL '1 second'
					AND (te.is_cancel IS NULL OR te.is_cancel = FALSE)
				GROUP BY us.email, us.name
			) fnl ON tu2.email = fnl.email_room
		WHERE
			tu2.email ILIKE '%@room.com%'
			AND tu2.email != 'room@room.com'
			AND (tu2.is_deleted IS NULL OR tu2.is_deleted = false)
		ORDER BY tu2.name ASC;
	END;
$$;

CREATE FUNCTION public.room_available_list(where_clause text, order_clause text, paging text, fts text) RETURNS TABLE(_id uuid, name character varying, email character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
		RETURN QUERY EXECUTE (
				'
					SELECT
						u._id,
						u.name,
						u.email
					FROM
						tbl_users u
					WHERE
						u.type = ''room''
                        AND u.is_deleted IS NOT true
						AND u.email NOT IN (
							SELECT
								ed.attendee_email
							FROM
								tbl_events e,
								tbl_event_details ed
							WHERE
								e._id = ed.event_id
								AND ( '
									||SUBSTRING(where_clause, 6)||
						'))'

			);
END;
$$;

CREATE FUNCTION public.room_detail(where_clause text, order_clause text, paging text, fts text) RETURNS TABLE(_id uuid, name character varying, email character varying, role_id uuid, floor character varying, capacity character varying, building character varying, feature character varying, is_deleted boolean, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$

	DECLARE var_str_where TEXT := '';

BEGIN

	IF where_clause != '' THEN
		var_str_where := where_clause || ' AND ';
	ELSE
		var_str_where := 'WHERE ';
	END IF;

	RETURN QUERY EXECUTE ('
			SELECT
				_id,
				name,
				email,
				role_id,
				floor,
				capacity,
				building,
				feature,
				is_deleted,
				created_at,
				updated_at
			FROM
				tbl_users '
			||var_str_where|| ' type = ''room'' '||paging
	);

END;
$$;

CREATE FUNCTION public.room_list(where_clause text, order_clause text, paging text, fts text) RETURNS TABLE(_id uuid, name character varying, email character varying, floor character varying, capacity character varying, building character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
	IF where_clause = '' THEN
		RETURN QUERY EXECUTE (
				'
					SELECT
						u._id,
						u.name,
						u.email,
						u.floor,
						u.capacity,
						u.building
					FROM
						tbl_users u
					WHERE
						u.type = ''room''
                    AND u.is_deleted IS NOT true'

			);
	ELSE
		RETURN QUERY EXECUTE (
				'
					SELECT
						u._id,
						u.name,
						u.email,
						u.floor,
						u.capacity,
						u.building
					FROM
						tbl_users u '
					||where_clause||
						' AND u.type = ''room''
                    AND u.is_deleted IS NOT true'

			);
	END IF;
END;
$$;

CREATE FUNCTION public.settings_get_data(where_clause text, order_clause text, paging text, fts text) RETURNS TABLE(id uuid, lock_timer integer, led_timer integer, table_input boolean, not_checked_in_time_limit integer, time_of_event_start_soon integer, available_color character varying, will_start_color character varying, on_meeting_color character varying)
    LANGUAGE plpgsql
    AS $$
	BEGIN
		RETURN QUERY
			SELECT
	            tas._id AS id,
	            tas.lock_timer,
	            tas.led_timer,
	            tas.table_input,
	            tas.not_checked_in_time_limit,
	            tas.time_of_event_start_soon,
	            tas.available_color,
	            tas.will_start_color,
	            tas.on_meeting_color
            FROM
	tbl_app_settings tas
            LIMIT 1;
	END;
$$;

CREATE FUNCTION public.settings_update(settings_data jsonb) RETURNS TABLE(room_list character varying)
    LANGUAGE plpgsql
    AS $_$
	BEGIN
		EXECUTE (
	'UPDATE
				tbl_app_settings
			SET
	lock_timer=$1,
				led_timer=$2,
				table_input=$3,
				not_checked_in_time_limit=$4,
				time_of_event_start_soon=$5,
				available_color=$6,
				will_start_color=$7,
				on_meeting_color=$8,
				updated_at = NOW()
			WHERE _id = $9'
	) USING
		(settings_data->>'lock_timer')::integer,
		(settings_data->>'led_timer')::integer,
		(settings_data->>'table_input')::boolean,
		(settings_data->>'not_checked_in_time_limit')::integer,
		(settings_data->>'time_of_event_start_soon')::integer,
		settings_data->>'available_color',
		settings_data->>'will_start_color',
		settings_data->>'on_meeting_color',
		(settings_data->>'id')::uuid;

		RETURN QUERY SELECT email AS room_list FROM tbl_users WHERE email ILIKE '%@room.com%';
	END;
$_$;

CREATE FUNCTION public.users_detail(where_clause text, order_clause text, paging text, fts text) RETURNS TABLE(_id uuid, name character varying, email character varying, password character varying, is_deleted boolean, role character varying)
    LANGUAGE plpgsql
    AS $$
	DECLARE var_str_where TEXT := '';
	BEGIN

	IF where_clause != '' THEN
		var_str_where := where_clause;
	ELSE
		var_str_where := 'WHERE ';
	END IF;

	RETURN QUERY EXECUTE ('
			SELECT
				u._id,
				u.name,
				u.email,
				u.password,
				u.is_deleted,
				r.role_name AS role
			FROM
				tbl_users u JOIN tbl_role r ON r._id = u.role_id '
			||var_str_where
	);

END;
$$;

CREATE FUNCTION public.users_insert_data(columnname character varying[], columnvalue character varying[]) RETURNS TABLE(_id uuid, name character varying, email character varying, password character varying, hashed_password character varying, role_id uuid, is_deleted boolean, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$

-- <<< DECLARE ALL CONSTANT & VARIABLE SECTION
	DECLARE
		var_sql_insert_query TEXT := '';
		var_sql_insert_column TEXT := '';
		var_sql_insert_value TEXT := '';
		var_sql_insert_values TEXT := '';
		var_array_column_count INT := 0;
		var_array_row_count INT := 0;
	BEGIN
		var_sql_insert_column := array_to_string(columnname, ',');
		var_array_row_count := ARRAY_LENGTH(columnvalue, 1);
		var_array_column_count := ARRAY_LENGTH(columnvalue, 2);

		FOR i IN 1..var_array_row_count  LOOP
			var_sql_insert_value := '';

			FOR x IN 1..var_array_column_count  LOOP
				var_sql_insert_value := var_sql_insert_value || quote_literal(columnvalue[i][x]) ;
--
				IF x != var_array_column_count THEN
					var_sql_insert_value := var_sql_insert_value || ',';
				END IF;
--
			END LOOP;
--
			var_sql_insert_values := var_sql_insert_values || '(' || var_sql_insert_value || ')';
			IF i != var_array_row_count THEN
				var_sql_insert_values := var_sql_insert_values || ',';
			END IF;
--
		END LOOP;

		EXECUTE 'INSERT INTO tbl_users(' || var_sql_insert_column || ') VALUES ('|| var_sql_insert_value || ')';

		RETURN QUERY EXECUTE '
		SELECT
			_id,
			name,
			email,
			password,
			hashed_password,
			role_id,
			is_deleted,
			created_at,
			updated_at
		FROM tbl_users
		' ;

	END;
$$;

CREATE FUNCTION public.users_list(where_clause text, order_clause text, paging text, fts text) RETURNS TABLE(email character varying, name character varying, _id uuid)
    LANGUAGE plpgsql
    AS $$
	DECLARE var_str_where TEXT := '';
	BEGIN
	IF where_clause = '' THEN
		RETURN QUERY EXECUTE (
				'
					SELECT
						DISTINCT(u.email),
						name,
						_id
					FROM
						tbl_users u
					WHERE
						u.type = ''employee''
                    AND u.is_deleted IS NOT true'

			);
	ELSE
		RETURN QUERY EXECUTE (
				'
					SELECT
						DISTINCT(u.email),
						name,
						_id
					FROM
						tbl_users u '
					||where_clause||
						' AND u.type = ''employee''
                    AND i.is_deleted IS NOT true'

			);
	END IF;
END;
$$;

CREATE FUNCTION public.users_list_data(where_clause text, order_clause text, paging text, fts text) RETURNS TABLE(_id uuid, name character varying, email character varying, role_id uuid, card_number character varying, is_deleted boolean, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$

	DECLARE var_str_where TEXT := '';

BEGIN

	IF where_clause != '' THEN
		var_str_where := where_clause || ' AND ';
	ELSE
		var_str_where := 'WHERE ';
	END IF;

	RETURN QUERY EXECUTE ('
			SELECT
				_id,
				name,
				email,
				role_id,
				card_number,
				is_deleted,
				created_at,
				updated_at
			FROM
				tbl_users '
			||var_str_where|| ' type = ''employee'' '||paging
	);

END;
$$;

CREATE FUNCTION public.users_update_data(update_clause jsonb, where_clause jsonb) RETURNS TABLE(_id uuid, name character varying, email character varying, role_id uuid, is_deleted boolean, created_at timestamp without time zone, updated_at timestamp without time zone, type character varying, floor character varying, capacity character varying, building character varying, feature character varying)
    LANGUAGE plpgsql
    AS $$
DECLARE
    update_query TEXT := '';
    where_query TEXT := '';
	dynamic_query TEXT := '';
BEGIN
    -- Generate the SET clause for the update query
    FOR i IN 0 .. jsonb_array_length(update_clause) - 1
    LOOP
        update_query := update_query || (update_clause->i->>'column_name') || ' = ' || quote_literal((update_clause->i->>'column_value')) || ', ';
    END LOOP;
    update_query := update_query || 'updated_at = NOW()';

	-- Generate the WHERE clause for the update query
	FOR j IN 0 .. jsonb_array_length(where_clause) - 1
	LOOP
		where_query := where_query || (where_clause->j->>'column_name') || ' ' || (where_clause->j->>'operator') || ' ' || quote_literal((where_clause->j->>'column_value')) || ' AND ';
	END LOOP;
	-- Remove the trailing 'AND' from the WHERE clause
    where_query := substring(where_query from 1 for char_length(where_query) - 5);

    -- Construct the dynamic query
    -- Returning syntax is to return back the data updated
	dynamic_query := 'UPDATE tbl_users SET ' || update_query || ' WHERE ' || where_query || ' RETURNING _id, name, email, role_id, is_deleted, created_at, updated_at, type, floor, capacity, building, feature';

    RAISE NOTICE 'Query: %', dynamic_query;
	RETURN QUERY EXECUTE dynamic_query;
EXCEPTION
-- Rollback the transaction in case of an error
    WHEN OTHERS THEN
        -- Rollback the transaction
        -- Raise the error again to propagate it
        RAISE;
END;
$$;

COMMIT;
