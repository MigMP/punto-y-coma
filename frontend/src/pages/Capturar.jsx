import React, { useEffect, useMemo, useState } from "react";

import NavBar from "../components/layout/NavBar.jsx";

import { useAuth } from "../state/AuthContext.jsx";
import { apiJSON } from "../services/api.js";

import { useToast } from "../components/feedback/ToastProvider.jsx";
import { useConfirm } from "../components/feedback/ConfirmProvider.jsx";

import "../styles/dashboard.css";
import "../styles/coach.css";

function fmtGrade(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

function gradeClass(value) {

  const n = Number(value);

  if (!Number.isFinite(n)) return "";
  if (n < 6) return "bad";
  if (n < 8) return "warn";

  return "ok";
}

export default function Capturar() {

  const { showToast } = useToast();
  const confirm = useConfirm();

  const { user, token: ctxToken } = useAuth();

  useEffect(() => {

    document.body.classList.add("app-bg");

    return () => {
      document.body.classList.remove("app-bg");
    };

  }, []);

  const token = useMemo(() => {

    return ctxToken || localStorage.getItem("token") || "";

  }, [ctxToken]);

  const [materias, setMaterias] = useState([]);
  const [calificaciones, setCalificaciones] = useState([]);

  const [form, setForm] = useState({

    alumnoNombre:"",
    alumnoEmail:"",
    materiaId:"",
    calificacion:""

  });

  const [filtroMateria,setFiltroMateria] = useState("ALL");

  const [orden,setOrden] = useState("DESC");

  const [editId,setEditId] = useState(null);

  const [editVal,setEditVal] = useState("");

  const [loading,setLoading] = useState(true);

  const [saving,setSaving] = useState(false);

  const loadTeacherData = async()=>{

    try{

      setLoading(true);

      const [
        materiasData,
        calificacionesData

      ] = await Promise.all([

        apiJSON("/materias",{token}),
        apiJSON("/calificaciones",{token})

      ]);

      const materiasArr = Array.isArray(materiasData)
        ? materiasData
        : [];

      setMaterias(materiasArr);

      setCalificaciones(
        Array.isArray(calificacionesData)
        ? calificacionesData
        : []
      );

      setForm(prev=>({

        ...prev,

        materiaId:
        prev.materiaId ||
        (materiasArr[0]?.id ? String(materiasArr[0].id):"")

      }));

    }catch(error){

      showToast({

        type:"error",
        title:"Error al cargar datos",
        message:error.message

      });

    }finally{

      setLoading(false);

    }

  };

  useEffect(()=>{

    loadTeacherData();

    // eslint-disable-next-line

  },[]);

  const calificacionesFiltradas = useMemo(()=>{

    let data=[...calificaciones];

    if(filtroMateria !== "ALL"){

      data=data.filter(
        c=>String(c.materiaId)===String(filtroMateria)
      );

    }

    data.sort((a,b)=>{

      return orden==="DESC"
      ? Number(b.calificacion)-Number(a.calificacion)
      : Number(a.calificacion)-Number(b.calificacion);

    });

    return data;

  },[calificaciones,filtroMateria,orden]);

  const alumnosEvaluados = useMemo(()=>{

    return new Set(
      calificaciones.map(
        c=>String(c.alumnoEmail || "").toLowerCase()
      )
    ).size;

  },[calificaciones]);

  const promedioGeneral = useMemo(()=>{

    const nums = calificaciones
    .map(c=>Number(c.calificacion))
    .filter(Number.isFinite);

    if(!nums.length)return null;

    return nums.reduce((a,b)=>a+b,0)/nums.length;

  },[calificaciones]);

  const enRiesgo = useMemo(()=>{

    return calificaciones.filter(
      c=>Number(c.calificacion)<7
    ).length;

  },[calificaciones]);

  const addCalificacion = async(e)=>{

    e.preventDefault();

    if(!form.alumnoNombre || !form.alumnoEmail){

      showToast({

        type:"warning",
        title:"Datos incompletos",
        message:"Completa todos los campos."

      });

      return;

    }

    try{

      setSaving(true);

      await apiJSON("/calificaciones",{

        token,
        method:"POST",

        body:{

          alumnoNombre:form.alumnoNombre,
          alumnoEmail:form.alumnoEmail,
          materiaId:Number(form.materiaId),
          calificacion:Number(form.calificacion)

        }

      });

      showToast({

        type:"success",
        title:"Calificación registrada",
        message:"El alumno fue actualizado correctamente."

      });

      setForm(prev=>({

        ...prev,
        alumnoNombre:"",
        alumnoEmail:"",
        calificacion:""

      }));

      await loadTeacherData();

    }catch(error){

      showToast({

        type:"error",
        title:"No se guardó",
        message:error.message

      });

    }finally{

      setSaving(false);

    }

  };

  const deleteCalificacion = async(calificacion)=>{

    const ok = await confirm({

      title:"Eliminar calificación",

      message:`¿Eliminar registro de ${
        calificacion.alumnoNombre
      }?`,

      confirmText:"Eliminar",
      tone:"danger"

    });

    if(!ok)return;

    try{

      await apiJSON(`/calificaciones/${calificacion.id}`,{

        token,
        method:"DELETE"

      });

      showToast({

        type:"success",
        title:"Eliminado",
        message:"La calificación fue eliminada."

      });

      await loadTeacherData();

    }catch(error){

      showToast({

        type:"error",
        title:"Error",
        message:error.message

      });

    }

  };

  const startEdit=(c)=>{

    setEditId(c.id);
    setEditVal(String(c.calificacion));

  };

  const cancelEdit=()=>{

    setEditId(null);
    setEditVal("");

  };

  const saveEdit=async()=>{

    try{

      await apiJSON(`/calificaciones/${editId}`,{

        token,

        method:"PATCH",

        body:{
          calificacion:Number(editVal)
        }

      });

      showToast({

        type:"success",
        title:"Cambios guardados",
        message:"Calificación actualizada."

      });

      cancelEdit();

      await loadTeacherData();

    }catch(error){

      showToast({

        type:"error",
        title:"No actualizado",
        message:error.message

      });

    }

  };

  return (

    <>

      <NavBar/>

      <main className="container">

        <section className="card row-between">

          <div>

            <h1>Gestión de calificaciones</h1>

            <p className="msg">
              {user?.name} · Control académico de alumnos
            </p>

          </div>

          <button
            className="btn-ghost"
            onClick={loadTeacherData}
          >
            Actualizar
          </button>

        </section>

        <section className="card">

          <h2>Resumen del maestro</h2>

          <div className="coachRow">

            <div className="kpi">
              <div className="kpiTitle">Materias</div>
              <div className="kpiValue">{materias.length}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Registros</div>
              <div className="kpiValue">{calificaciones.length}</div>
            </div>

            <div className="kpi">
              <div className="kpiTitle">Alumnos</div>
              <div className="kpiValue">{alumnosEvaluados}</div>
            </div>

            <div className="kpi">

              <div className="kpiTitle">
                Promedio
              </div>

              <div className="kpiValue">

                {
                promedioGeneral
                ? promedioGeneral.toFixed(2)
                :"—"
                }

              </div>

            </div>

          </div>

        </section>

        <section className="card">

          <h2>Capturar calificación</h2>

          <form
            className="gridX"
            onSubmit={addCalificacion}
          >

            <input
            placeholder="Alumno"
            value={form.alumnoNombre}
            onChange={e=>
              setForm({...form,alumnoNombre:e.target.value})
            }
            />

            <input
            placeholder="Correo"
            value={form.alumnoEmail}
            onChange={e=>
              setForm({...form,alumnoEmail:e.target.value})
            }
            />

            <select

            value={form.materiaId}

            onChange={e=>
              setForm({...form,materiaId:e.target.value})
            }

            >

              {materias.map(m=>

                <option
                key={m.id}
                value={m.id}
                >

                  {m.nombre}

                </option>

              )}

            </select>

            <input

            type="number"

            placeholder="Calificación"

            value={form.calificacion}

            onChange={e=>
              setForm({...form,calificacion:e.target.value})
            }

            />

            <button disabled={saving}>

              {
              saving
              ?"Guardando..."
              :"Guardar"
              }

            </button>

          </form>

        </section>

        <section className="card">

          <h2>Registros</h2>

          <div className="lista">

            {calificacionesFiltradas.map(c=>(

              <div
              className="item"
              key={c.id}
              >

                <div>

                  <strong>

                    {c.alumnoNombre}

                  </strong>

                  <p className="muted">

                    {c.materiaNombre}

                  </p>

                </div>

                <div className="right">

                {

                editId===c.id

                ?<>

                  <input

                  value={editVal}

                  onChange={e=>setEditVal(e.target.value)}

                  />

                  <button onClick={saveEdit}>
                    Guardar
                  </button>

                  <button
                  className="btn-del"
                  onClick={cancelEdit}
                  >
                    Cancelar
                  </button>

                </>

                :<>

                  <span className={`badge ${gradeClass(c.calificacion)}`}>

                    {fmtGrade(c.calificacion)}

                  </span>

                  <button onClick={()=>startEdit(c)}>

                    Editar

                  </button>

                  <button
                  className="btn-del"
                  onClick={()=>deleteCalificacion(c)}
                  >

                    Eliminar

                  </button>

                </>

                }

                </div>

              </div>

            ))}

            {!calificacionesFiltradas.length && (

              <p className="msg">

                {
                loading
                ?"Cargando..."
                :"Sin registros"
                }

              </p>

            )}

          </div>

        </section>

      </main>

    </>

  );

}