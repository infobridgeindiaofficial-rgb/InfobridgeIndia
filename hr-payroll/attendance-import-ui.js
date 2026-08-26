export function attendanceImportProgressController(form,total){
  const button=form.querySelector("[data-modal-submit]"),progress=form.querySelector("[data-attendance-import-progress]");
  if(!button||!progress)throw Error("Attendance import modal controls are unavailable.");
  const saving=saved=>{const message=`Saving attendance... ${saved} / ${total}`;button.disabled=true;button.textContent=message;progress.textContent=message};
  return{
    start(){saving(0)},
    update(saved){saving(saved)},
    fail(error,saved=0){progress.textContent=`Attendance import failed after ${saved} / ${total} rows. ${error.message}`;button.disabled=false;button.textContent="Retry attendance import"},
    button,
    progress,
  };
}
